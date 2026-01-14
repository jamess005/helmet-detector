from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from ultralytics import YOLO
import cv2
import os
import subprocess
import numpy as np
from tracking import TrackClassifier


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from config import (
    UPLOAD_IMAGE_DIR,
    UPLOAD_VIDEO_DIR,
    ANNOTATED_IMAGE_DIR,
    ANNOTATED_VIDEO_DIR,
    MODEL_PATH
)


os.makedirs(UPLOAD_IMAGE_DIR, exist_ok=True)
os.makedirs(UPLOAD_VIDEO_DIR, exist_ok=True)
os.makedirs(ANNOTATED_IMAGE_DIR, exist_ok=True)
os.makedirs(ANNOTATED_VIDEO_DIR, exist_ok=True)

app.mount("/annotated/images", StaticFiles(directory=ANNOTATED_IMAGE_DIR), name="annotated_images")
app.mount("/annotated/videos", StaticFiles(directory=ANNOTATED_VIDEO_DIR), name="annotated_videos")

@app.get("/annotated/{filename}")
async def get_annotated_file(filename: str):
    safe_name = os.path.basename(filename)
    image_path = os.path.join(ANNOTATED_IMAGE_DIR, safe_name)
    video_path = os.path.join(ANNOTATED_VIDEO_DIR, safe_name)
    
    if os.path.exists(image_path):
        return FileResponse(image_path)
    if os.path.exists(video_path):
        return FileResponse(video_path)
    
    raise HTTPException(status_code=404, detail="File not found")

model = YOLO(MODEL_PATH)
print(f"Model loaded. Classes: {model.names}")


@app.post("/image")
async def image_check(file: UploadFile = File(...)):
    print(f"\n{'='*60}")
    print(f"IMAGE ANALYSIS: {file.filename}")
    print(f"{'='*60}")
    
    input_path = os.path.join(UPLOAD_IMAGE_DIR, file.filename)
    contents = await file.read()
    
    with open(input_path, "wb") as f:
        f.write(contents)

    img = cv2.imread(input_path)
    if img is None:
        return {"error": "Could not read image"}

    results = model(img, conf=0.5, iou=0.55, agnostic_nms=True)
    result = results[0]
    
    violations = 0
    compliant = 0
    
    for box in result.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        
        if cls_id == 0:
            violations += 1
        elif cls_id == 1:
            compliant += 1

    annotated_filename = f"annotated_{file.filename}"
    annotated_path = os.path.join(ANNOTATED_IMAGE_DIR, annotated_filename)
    annotated_img = result.plot()
    cv2.imwrite(annotated_path, annotated_img)
    
    print(f"✓ RESULTS: {violations} violations, {compliant} compliant, {violations + compliant} total")

    return {
        "annotated_image": annotated_filename,
        "violations": violations,
        "compliant": compliant,
        "total_detections": violations + compliant,
    }


@app.post("/video")
async def video_check(file: UploadFile = File(...)):
    print(f"\n{'='*60}")
    print(f"VIDEO ANALYSIS: {file.filename}")
    print(f"{'='*60}")
    
    input_path = os.path.join(UPLOAD_VIDEO_DIR, file.filename)
    contents = await file.read()
    
    with open(input_path, "wb") as f:
        f.write(contents)

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return {"error": "Could not open video"}

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_duration = total_frames / fps
    
    print(f"Video: {width}x{height} @ {fps:.1f}fps, {total_frames} frames, {video_duration:.1f}s")

    annotated_filename = f"annotated_{file.filename}"
    temp_output = os.path.join(ANNOTATED_VIDEO_DIR, f"temp_{file.filename}")
    output_path = os.path.join(ANNOTATED_VIDEO_DIR, annotated_filename)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(temp_output, fourcc, fps, (width, height))

    classifier = TrackClassifier(
        confidence_threshold=0.5,
        hysteresis_factor=1.3,
        fps=fps
    )
    
    frame_count = 0
    print(f"Processing with object tracking...")

    results = model.track(
        source=input_path,
        conf=0.55,
        iou=0.5,
        agnostic_nms=True,
        persist=True,
        tracker="bytetrack.yaml",
        stream=True
    )

    for result in results:
        frame_count += 1
        annotated_frame = result.plot()
        out.write(annotated_frame)
        
        if result.boxes is not None and result.boxes.id is not None:
            boxes = result.boxes
            track_ids = boxes.id.cpu().numpy().astype(int)
            class_ids = boxes.cls.cpu().numpy().astype(int)
            confidences = boxes.conf.cpu().numpy()
            
            for track_id, cls_id, conf in zip(track_ids, class_ids, confidences):
                classifier.update(track_id, cls_id, conf, frame_count)
            
            if frame_count % 30 == 0:
                temp_violations, temp_compliant = classifier.get_final_counts()
                print(f"  Frame {frame_count}/{total_frames}: {len(track_ids)} detections")

    cap.release()
    out.release()
    
    print(f"✓ Processed {frame_count} frames")

    min_seconds_threshold = 4.0
    min_frames_threshold = int(fps * min_seconds_threshold)
    
    print(f"\nFiltering: {min_frames_threshold} frames ({min_seconds_threshold}s), min confidence 0.50")
    final_violations, final_compliant = classifier.get_final_counts(
        min_frames=min_frames_threshold,
        min_avg_confidence=0.50
    )
    
    track_summary = classifier.get_track_summary(total_frames)
    print(f"\n{'='*40}")
    print(f"TRACK SUMMARY:")
    print(f"{'='*40}")
    
    valid_tracks = []
    invalid_tracks = []
    
    for track_id, stats in track_summary.items():
        if stats['total_detections'] >= min_frames_threshold:
            valid_tracks.append((track_id, stats))
        else:
            invalid_tracks.append((track_id, stats))
    
    # Prepare detailed track data for frontend
    personnel_details = []
    violation_periods = []
    
    for track_id, stats in valid_tracks:
        class_name = "violation" if stats['final_class'] == 0 else "compliant"
        temporal = stats.get('temporal', {})
        
        track_detail = {
            'track_id': int(track_id),
            'classification': class_name,
            'duration': temporal.get('duration', 0),
            'first_appearance': temporal.get('first_time', 0),
            'last_appearance': temporal.get('last_time', 0),
            'confidence': float(stats['avg_confidence']),
            'observations': stats['total_detections'],
            'video_percentage': stats['video_percentage']
        }
        personnel_details.append(track_detail)
        
        # Track violation periods
        if stats['final_class'] == 0:
            violation_periods.append({
                'start': temporal.get('first_time', 0),
                'end': temporal.get('last_time', 0),
                'track_id': int(track_id)
            })
    
    if valid_tracks:
        print(f"\n✓ VALID TRACKS:")
        for track_id, stats in valid_tracks:
            class_name = "VIOLATION" if stats['final_class'] == 0 else "Compliant"
            print(f"  Track {track_id}: {stats['total_detections']} detections → {class_name}")
            print(f"    Top-{stats['top_k_size']} sums: {dict(stats['top_k_sums'])}")
    
    if invalid_tracks:
        print(f"\n⚠ FILTERED TRACKS:")
        for track_id, stats in invalid_tracks:
            print(f"  Track {track_id}: {stats['total_detections']} frames (filtered)")
    
    print(f"\n✓ FINAL: {final_violations} violations, {final_compliant} compliant")

    # Re-encode for browser compatibility
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", temp_output,
            "-c:v", "libx264", "-preset", "fast",
            "-crf", "23", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            output_path
        ], check=True, capture_output=True, text=True)
        print(f"✓ Video encoded with h264")
        os.remove(temp_output)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"⚠ ffmpeg failed, using mp4v (may not play in all browsers)")
        os.rename(temp_output, output_path)

    # Calculate overall system metrics
    frame_coverage = (frame_count / total_frames * 100) if total_frames > 0 else 0
    overall_confidence = np.mean([t['confidence'] for t in personnel_details]) if personnel_details else 0
    
    return {
        "annotated_video": annotated_filename,
        "violations": final_violations,
        "compliant": final_compliant,
        "total_detections": final_violations + final_compliant,
        "video_path": f"/annotated/videos/{annotated_filename}",
        "file_exists": os.path.exists(output_path),
        "file_size": os.path.getsize(output_path) if os.path.exists(output_path) else 0,
        "frames_processed": frame_count,
        "unique_people_tracked": len(track_summary),
        "video_duration": video_duration,
        "fps": fps,
        "personnel_details": personnel_details,
        "violation_periods": violation_periods,
        "filtered_tracks": len(invalid_tracks),
        "frame_coverage": frame_coverage,
        "overall_confidence": overall_confidence
    }