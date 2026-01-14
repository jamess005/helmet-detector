import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_IMAGE_DIR = os.getenv(
    "UPLOAD_IMAGE_DIR",
    os.path.join(BASE_DIR, "uploads/images")
)

UPLOAD_VIDEO_DIR = os.getenv(
    "UPLOAD_VIDEO_DIR",
    os.path.join(BASE_DIR, "uploads/videos")
)

ANNOTATED_IMAGE_DIR = os.getenv(
    "ANNOTATED_IMAGE_DIR",
    os.path.join(BASE_DIR, "annotated/images")
)

ANNOTATED_VIDEO_DIR = os.getenv(
    "ANNOTATED_VIDEO_DIR",
    os.path.join(BASE_DIR, "annotated/videos")
)

MODEL_PATH = os.getenv(
    "MODEL_PATH",
    os.path.join(BASE_DIR, "models/combined-v11/weights/best.pt")
)
