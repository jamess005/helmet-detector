import numpy as np
from collections import defaultdict, Counter


class TrackClassifier:
    """Track people across frames and classify via top-30 sum voting."""
    
    def __init__(self, confidence_threshold=0.5, hysteresis_factor=1.2, fps=25.0):
        self.confidence_threshold = confidence_threshold
        self.hysteresis_factor = hysteresis_factor
        self.track_history = defaultdict(list)
        self.fps = fps
        self.frame_appearances = defaultdict(list)  # Track which frames each track appears in
    
    def update(self, track_id, class_id, confidence, frame_number):
        """Record detection for a tracked person."""
        if confidence >= self.confidence_threshold:
            self.track_history[track_id].append((class_id, confidence))
            self.frame_appearances[track_id].append(frame_number)
    
    def get_track_class(self, track_id):
        """
        Classify track using top-30 sum voting.
        
        1. Sort all detections by confidence
        2. Take top 30 most confident
        3. Sum confidences for each class
        4. Pick class with higher sum
        5. Tiebreakers: count, then hysteresis
        """
        if track_id not in self.track_history or len(self.track_history[track_id]) == 0:
            return None
        
        detections = self.track_history[track_id]
        sorted_detections = sorted(detections, key=lambda x: x[1], reverse=True)
        top_k = min(30, len(sorted_detections))
        top_detections = sorted_detections[:top_k]
        
        class_sums = defaultdict(float)
        class_counts = defaultdict(int)
        class_confs = defaultdict(list)
        
        for cls_id, conf in top_detections:
            class_sums[cls_id] += conf
            class_counts[cls_id] += 1
            class_confs[cls_id].append(conf)
        
        if len(class_sums) == 1:
            cls_id = list(class_sums.keys())[0]
            return (cls_id, np.mean(class_confs[cls_id]))
        
        sum_0 = class_sums.get(0, 0)
        sum_1 = class_sums.get(1, 0)
        
        # Primary: sum difference
        if abs(sum_0 - sum_1) > 0.5:
            winner = 0 if sum_0 > sum_1 else 1
            return (winner, np.mean(class_confs[winner]))
        
        # Tiebreaker 1: count
        count_0 = class_counts.get(0, 0)
        count_1 = class_counts.get(1, 0)
        
        if count_0 != count_1:
            winner = 0 if count_0 > count_1 else 1
            return (winner, np.mean(class_confs[winner]))
        
        # Tiebreaker 2: hysteresis (favor helmet)
        if 1 in class_sums:
            return (1, np.mean(class_confs[1]))
        
        winner = 0 if sum_0 > sum_1 else 1
        return (winner, np.mean(class_confs[winner]))
    
    def get_temporal_data(self, track_id):
        """Get temporal information about a track."""
        if track_id not in self.frame_appearances:
            return None
        
        frames = self.frame_appearances[track_id]
        first_frame = min(frames)
        last_frame = max(frames)
        
        first_time = first_frame / self.fps
        last_time = last_frame / self.fps
        duration = last_time - first_time
        
        return {
            'first_frame': first_frame,
            'last_frame': last_frame,
            'first_time': first_time,
            'last_time': last_time,
            'duration': duration,
            'frame_count': len(frames)
        }
    
    def get_final_counts(self, min_frames=30, min_avg_confidence=0.5):
        """Apply filters and return final violation and compliant counts."""
        violations = 0
        compliant = 0
        total_tracks = 0
        filtered_tracks = 0
        
        for track_id in self.track_history:
            total_tracks += 1
            detections = self.track_history[track_id]
            
            if len(detections) < min_frames:
                filtered_tracks += 1
                print(f"  ⚠ Ignoring Track {track_id}: Only {len(detections)} frames (< {min_frames} threshold)")
                continue
            
            avg_conf = np.mean([conf for _, conf in detections])
            if avg_conf < min_avg_confidence:
                filtered_tracks += 1
                print(f"  ⚠ Ignoring Track {track_id}: Low confidence {avg_conf:.2f} (< {min_avg_confidence} threshold)")
                continue
            
            result = self.get_track_class(track_id)
            if result is not None:
                class_id, conf = result
                if class_id == 0:
                    violations += 1
                elif class_id == 1:
                    compliant += 1
        
        print(f"\n  Total tracks detected: {total_tracks}")
        print(f"  Tracks filtered out: {filtered_tracks}")
        print(f"  Valid tracks counted: {violations + compliant}")
        
        return violations, compliant
    
    def get_track_summary(self, total_frames):
        """Return detailed statistics for each track."""
        summary = {}
        for track_id in self.track_history:
            detections = self.track_history[track_id]
            class_votes = Counter([cls_id for cls_id, _ in detections])
            result = self.get_track_class(track_id)
            temporal = self.get_temporal_data(track_id)
            
            sorted_detections = sorted(detections, key=lambda x: x[1], reverse=True)
            top_k = min(30, len(sorted_detections))
            top_detections = sorted_detections[:top_k]
            
            top_class_sums = defaultdict(float)
            top_class_counts = defaultdict(int)
            for cls_id, conf in top_detections:
                top_class_sums[cls_id] += conf
                top_class_counts[cls_id] += 1
            
            # Calculate average confidence from top-30
            avg_confidence = np.mean([conf for _, conf in top_detections]) if top_detections else 0.0
            
            # Calculate percentage of video
            video_percentage = (len(detections) / total_frames * 100) if total_frames > 0 else 0
            
            summary[track_id] = {
                'total_detections': len(detections),
                'class_distribution': dict(class_votes),
                'final_class': result[0] if result else None,
                'final_confidence': result[1] if result else None,
                'top_k_size': top_k,
                'top_k_sums': dict(top_class_sums),
                'top_k_counts': dict(top_class_counts),
                'avg_confidence': avg_confidence,
                'temporal': temporal,
                'video_percentage': video_percentage
            }
        
        return summary