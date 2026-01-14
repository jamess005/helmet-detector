# hardhat-safety-compliance

A hard hat detection system for construction site safety monitoring. Identifies PPE compliance violations by detecting whether workers are wearing hard hats in images and video footage.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.12.3-blue)
![YOLOv11](https://img.shields.io/badge/YOLO-v11-green)

## Project Overview

This system detects and classifies construction workers as either **compliant** (wearing hard hat) or **violation** (not wearing hard hat) in uploaded images and videos. It demonstrates an end-to-end computer vision pipeline: custom model training, API development, web interface, and containerised deployment.

### What It Does

- **Image analysis**: Upload a photo → Get instant detection with bounding boxes and violation counts
- **Video analysis**: Upload video → Track individuals across frames → Output annotated video with per-person compliance status

### Key Components

- **Custom YOLOv11 Model**: Fine-tuned on construction dataset (5,500+ images) for two classes: head and helmet
- **ByteTrack Integration**: Maintains consistent person IDs across video frames
- **Confidence Voting System**: Uses top-30 most confident detections per track to determine final classification
- **Temporal Filtering**: 4-second minimum visibility threshold filters unstable tracks
- **FastAPI Backend**: Handles uploads, runs inference, returns results with detailed analytics
- **Web Interface**: Drag-and-drop upload, timeline visualisation, per-person tracking details

## Why These Methods?

The model was trained on a relatively small dataset (~5,500 images) with limited angle variation. This creates accuracy challenges:

- **ID jumping**: Tracking occasionally loses individuals and reassigns IDs as they move
- **Classification flickering**: Model switches between "head" and "helmet" across consecutive frames
- **Edge-of-frame noise**: Brief detections as people enter/exit the monitored area

The engineering approach compensates for these model limitations:

- **4-second minimum visibility**: Filters out ID jumps and transient detections caused by tracking instability
- **Top-30 confidence voting**: Reduces impact of low-confidence misclassifications by weighting reliable detections more heavily
- **Track-based analysis**: Aggregates evidence across frames rather than treating each frame independently

With a larger, more varied dataset, these thresholds could be relaxed. For now, they ensure consistent outputs despite model imperfections.

## Technical Stack

```
Frontend (Vanilla JS) → FastAPI (Port 8000) → YOLOv11 + ByteTrack → Results + Annotated Media
```

**Model**: YOLOv11-small (custom trained, 2 classes: head, helmet)  
**Tracking**: ByteTrack for temporal person identification  
**Backend**: FastAPI with custom TrackClassifier for statistical voting  
**Frontend**: Web interface with timeline visualisation and detailed analytics  
**Deployment**: Docker container (Python 3.12.3, includes ffmpeg for video encoding)

## Performance Metrics

| Metric | Value | Context |
|--------|-------|---------|
| Precision | 94.5% | Final epoch (85 epochs) |
| Recall | 91.0% | Detection coverage |
| mAP@0.5 | 95.7% | IoU threshold 0.5 |
| mAP@0.5:0.95 | 64.3% | Stricter IoU range |

**Caveat**: The base dataset reuses test images for validation (no separate validation split), which may inflate these metrics. Real-world performance on novel footage is lower, particularly for unusual viewing angles or occlusion scenarios.

## Installation & Usage

### Quick Start with Docker

```bash
# Clone repository
git clone https://github.com/jamess005/hardhat-safety-compliance.git
cd hardhat-safety-compliance

# Build and run backend
docker build -t hardhat-detector .
docker run -p 8000:8000 hardhat-detector

# Serve frontend (separate terminal)
cd frontend
python -m http.server 8080

# Access: http://localhost:8080
```

### Manual Installation

```bash
# Install dependencies
pip install -r requirements-runtime.txt

# Run backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000

# Serve frontend
cd frontend
python -m http.server 8080
```

### Usage

**Images**: Upload → Instant detection with bounding boxes and counts  
**Videos**: Upload → Processing with tracking → Annotated output with timeline and per-person details

The system returns:
- Violation count (people without hard hats)
- Compliant count (people with hard hats)
- Per-person tracking data (duration visible, confidence, observations)
- Timeline showing when violations occurred
- System quality metrics (tracking stability, overall confidence)

## Training Details

**Model**: YOLOv11-small  
**Hardware**: AMD Radeon RX 7800 XT  
**Training Time**: 85 epochs × 57s ≈ 1.3 hours  

**Hyperparameters**:
- Image size: 416×416
- Batch size: 64
- Learning rate: 0.007 (cosine decay)
- Classes: 2 (head, helmet)

**Dataset**:
- Base: RoboFlow construction dataset (~5,269 training images)
- Custom augmentation: 236 CVAT-annotated images (~1,100 head annotations)
- **Purpose of custom data**: Base dataset performed poorly on workers with long hair. Custom annotations specifically targeted this edge case with varied angles and occlusion patterns.

## API Endpoints

```bash
# Image analysis
POST /image
Content-Type: multipart/form-data
Body: file (image)

Response: {
  "annotated_image": "annotated_filename.jpg",
  "violations": 2,
  "compliant": 3,
  "total_detections": 5
}

# Video analysis  
POST /video
Content-Type: multipart/form-data
Body: file (video)

Response: {
  "annotated_video": "annotated_filename.mp4",
  "violations": 2,
  "compliant": 3,
  "total_detections": 5,
  "personnel_details": [...],      // Per-person tracking data
  "violation_periods": [...],       // Temporal violation windows
  "video_duration": 45.2,
  "overall_confidence": 0.87,
  "filtered_tracks": 3              // Tracks below 4s threshold
}
```

## Model Limitations

The model struggles with:

- **Overhead angles**: Detection degrades when camera is directly above workers (helmet shape obscured)
- **Partial occlusion**: Lower accuracy when face is covered (masks, scarves, looking away)
- **Non-safety headwear**: May misclassify caps or other headwear as helmets

These limitations stem from the dataset having relatively few examples of these edge cases. The dataset architecture also creates constraints:

**Bounding box design**: Training labels include both helmet AND face in a single box. This means:
- Model requires visible face to confidently classify "helmet"
- Struggles when face isn't clearly visible even if helmet is present
- Correctly avoids false positives from ground helmets, but creates brittleness for unusual angles

A production system would use separate detection classes with spatial association logic to overcome these limitations.

## What This Demonstrates

This portfolio piece shows practical ML engineering skills:

1. **Custom model training**: Fine-tuned YOLOv11 for specific use case (construction PPE detection)
2. **Identifying weaknesses**: Recognised poor performance on long hair through testing, targeted this with custom annotations
3. **Engineering workarounds**: Built tracking and voting systems to produce reliable outputs despite model limitations
4. **Full-stack implementation**: Model → FastAPI → Web interface → Docker deployment
5. **Production considerations**: Video encoding compatibility, error handling, detailed logging, frontend analytics

This represents a simulated real-world CV deployment: object detection for a specific domain, with practical engineering to handle imperfect training data.

## Future Improvements

### If Deploying to Production

- **Separate detection pipeline**: Train distinct detectors for person body, head region, and helmet with association logic rather than single two-class model
- **Expanded dataset**: More overhead angles, occlusion scenarios, varied lighting, diverse helmet types
- **Real-time streaming**: Support for live camera feeds (current system processes uploaded files)
- **Alert integration**: Immediate notifications when violations detected (SMS, email, dashboard)
- **Historical analytics**: Compliance trend analysis across time periods and sites

### Architecture Changes

Current approach: Single model outputs two classes (head, helmet) where helmet labels include the face region.

Production approach would use three-class detection with spatial association:

1. **Detect all objects**: Train YOLO to detect person (body), head, helmet as separate classes
2. **Associate detections**: 
   - For each person box → find head boxes inside it (IoU > 0.5)
   - For each head → check if any helmet box overlaps it (IoU > 0.3)
   - If helmet overlaps head → compliant; if not → violation
3. **Benefits**: Handles face occlusion (can detect head without clear face), doesn't require helmet to include face, correctly ignores helmets on ground (no head overlap)

This separates detection (YOLO's job) from compliance logic (post-processing) rather than forcing the model to learn the wearing relationship.

## Project Structure

```
hardhat-safety-compliance/
├── backend/
│   ├── main.py              # FastAPI application & endpoints
│   ├── tracking.py          # TrackClassifier (voting & filtering)
│   ├── config.py            # Environment configuration
│   └── models/              # YOLOv11 weights (best.pt)
├── frontend/
│   ├── index.html           # Web interface
│   ├── script.js            # Upload, API calls, visualisation
│   └── style.css            # Styling
├── Dockerfile               # Backend container (Python 3.12.3)
├── requirements-runtime.txt # Production dependencies
└── README.md
```

## Licence

This project is licensed under the MIT Licence - see [LICENSE](LICENSE) for details.

## Acknowledgements

- **Base Dataset**: RoboFlow Hard Hat Workers dataset
- **Custom Annotations**: CVAT for manual labelling workflow
- **Model Framework**: Ultralytics YOLOv11
- **Tracking Algorithm**: ByteTrack implementation

## Contact

**James Scott** - ML Engineering Portfolio  
[GitHub](https://github.com/jamess005) | [LinkedIn](https://linkedin.com/in/jamesscott005)

---

*This project demonstrates end-to-end computer vision system development: custom model training, practical engineering to handle data limitations, and deployment-ready implementation with FastAPI and Docker.*
