# Hard Hat Safety Detector

A real-time computer vision system for construction site safety monitoring. Detects and tracks workers to identify PPE compliance violations, specifically hard hat usage.

## Project Overview

This system uses a custom-trained YOLOv11 model with ByteTrack object tracking to monitor construction workers across video footage. Rather than relying on frame-by-frame analysis which produces unreliable results, the system tracks individuals over time and uses statistical voting to determine compliance status. The goal is to provide construction site managers with automated safety monitoring that reduces false positives and accurately identifies genuine violations.

### Key Features

- **Custom-Trained YOLOv11 Model**: Fine-tuned on 5,500+ images specifically for hard hat detection
- **Temporal Tracking**: ByteTrack integration for consistent person identification across frames
- **Statistical Classification**: Top-30 confidence voting system reduces false positives
- **Smart Filtering**: Minimum duration thresholds (4 seconds) eliminate spurious detections
- **Full-Stack Deployment**: FastAPI backend with web interface and Docker containerization
- **Dual Input Support**: Handles both single images and video files

## Technical Architecture

```
Frontend (JavaScript) → FastAPI → YOLOv11 + ByteTrack → Results + Annotated Media
```

**Backend**: FastAPI server running YOLOv11 inference with custom tracking logic  
**Model**: YOLOv11-small fine-tuned on combined dataset (RoboFlow + custom CVAT annotations)  
**Tracking**: ByteTrack for temporal consistency across frames  
**Deployment**: Dockerized application for consistent cross-platform execution

## Performance Metrics

| Metric | Value | Note |
|--------|-------|------|
| Precision | 94.5% | Final epoch performance |
| Recall | 91.0% | Detection coverage |
| mAP@0.5 | 95.7% | High-confidence detections |
| mAP@0.5:0.95 | 64.3% | Stricter IoU thresholds |

**Important Context**: The base dataset uses test images for validation (no separate validation split), which may inflate these metrics slightly. Real-world performance is expected to be lower, particularly at distance or unusual angles.

## Getting Started

### Prerequisites

- Docker and Docker Compose (recommended)
- OR Python 3.12.3 with pip

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/hardhat-safety-detector.git
cd hardhat-safety-detector

# Build and run
docker-compose up --build

# Access the application
# Frontend: http://localhost:8080
# API: http://localhost:8000
```

### Manual Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Run the backend
cd backend
python main.py

# Serve the frontend (separate terminal)
cd frontend
python -m http.server 8080
```

## Usage

### Image Analysis
1. Upload a single image through the web interface
2. System detects all visible people and classifies helmet usage
3. Returns annotated image with bounding boxes and compliance statistics

### Video Analysis
1. Upload video file (MP4, AVI, MOV supported)
2. System processes video with object tracking enabled
3. Tracks individuals across frames for minimum 4 seconds
4. Classifies each person using top-30 confidence voting
5. Returns annotated video with per-person timeline and violation summary

### API Endpoints

```bash
# Image analysis
POST /image
Content-Type: multipart/form-data
Body: file (image file)

# Video analysis
POST /video
Content-Type: multipart/form-data
Body: file (video file)
```

## Technical Implementation

### The Classification Strategy

The biggest challenge in helmet detection isn't the initial detection - it's handling inconsistent frame-by-frame results. A person might be correctly classified in one frame, misclassified in the next, then correct again. Simple majority voting fails because low-confidence detections carry equal weight.

**Solution**: Top-30 sum voting
1. Collect all detections for each tracked person
2. Sort by confidence, take top 30 most confident predictions
3. Sum confidence scores for each class (helmet vs. no-helmet)
4. Classify based on highest sum with hysteresis for edge cases

This approach dramatically reduces false violations while maintaining high recall.

### Tracking Implementation

Uses ByteTrack for person re-identification across frames. Key parameters:
- **Minimum appearance**: 4 seconds on screen (eliminates edge-of-frame errors)
- **Confidence threshold**: 0.5 for individual detections
- **Average confidence filter**: 0.5 minimum across all detections for a track

### Training Details

**Model**: YOLOv11-small  
**Hardware**: AMD Radeon RX 7800 XT  
**Training Time**: ~85 epochs × 57s = 1.3 hours  
**Image Size**: 416×416  
**Batch Size**: 64  
**Learning Rate**: 0.007 (with cosine decay)

**Dataset Composition**:
- Base: RoboFlow hard hat dataset (~5,269 training images)
- Augmentation: Custom CVAT-annotated dataset (~236 images, 1,100 annotations)
- Focus: People with long hair (identified weakness in base dataset)

## What I Learned

This project pushed me to think beyond model accuracy metrics and focus on production reliability:

1. **Data quality matters more than quantity**: The base dataset had 5,000+ images but struggled with long hair. Adding 236 targeted examples solved the issue.

2. **Frame-by-frame analysis is insufficient**: Object tracking + temporal voting transformed an unreliable system into a deployable one.

3. **Engineering around model limitations**: When the model struggles (distant workers, overhead angles), good filtering and thresholding can maintain system reliability.

4. **End-to-end thinking**: Training a good model is 30% of the work. API design, error handling, video encoding compatibility, and deployment infrastructure are equally important.

## Known Limitations

### Model Limitations
- **Overhead angles**: Struggles with directly top-down views where helmet shape is obscured
- **Partial occlusion**: Difficulty detecting helmets when face is covered (masks, scarves)
- **Distance**: Performance degrades for workers >30m from camera
- **Other headwear**: May misclassify caps or non-safety headwear as helmets

### Dataset Limitations
The training data has helmet bounding boxes that include both the helmet and face, which creates two issues:
1. **Conservative detection**: Model hesitates to classify as "helmet" without seeing a clear face
2. **Stray helmet problem**: Correctly avoids false positives from helmets laying on the ground, but may miss legitimate detections

**Future Improvement**: Separate head and helmet detection with association logic would solve both issues.

## Future Enhancements

- [ ] Separate head/helmet detection model with association rules
- [ ] Expanded dataset with more angles and occlusion examples  
- [ ] Multi-PPE detection (safety vests, gloves, boots)
- [ ] Real-time streaming support for live camera feeds
- [ ] Alert system integration for immediate violation notification
- [ ] Historical compliance analytics and reporting

## Project Structure

```
hardhat-safety-detector/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── tracking.py          # TrackClassifier + voting logic
│   ├── config.py            # Configuration management
│   └── models/              # YOLOv11 model weights
├── frontend/
│   ├── index.html           # Web interface
│   ├── script.js            # Frontend logic
│   └── style.css            # Styling
├── Dockerfile               # Container definition
├── docker-compose.yml       # Multi-container orchestration
├── requirements.txt         # Python dependencies
└── README.md
```

## Contributing

This is a portfolio project, but feedback and suggestions are welcome. Feel free to open issues for bugs or improvement ideas.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Base Dataset**: RoboFlow Hard Hat Workers dataset
- **Custom Annotations**: CVAT for manual labeling
- **Model**: Ultralytics YOLOv11
- **Tracking**: ByteTrack implementation

## Contact

**James** - Aspiring ML Engineer  
[GitHub](https://github.com/jamess005) | [LinkedIn](www.linkedin.com/in/jamesscott005)

---

*This project demonstrates practical ML engineering skills: identifying real-world problems, iterating on solutions through data and architecture changes, and building deployable systems. It represents my first complete computer vision portfolio piece.*
