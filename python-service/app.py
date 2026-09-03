from flask import Flask, request, jsonify
from ultralytics import YOLO
from pathlib import Path
import time
import os

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Use the bundled YOLOv8 nano model.
MODEL_PATH = BASE_DIR / "yolov8n.pt"

MODEL_CACHE = {}
MODEL = None


def get_model(model_name: str):
    if model_name not in MODEL_CACHE:
        model_file = model_name if model_name.endswith(".pt") else f"{model_name}.pt"

        # Use the bundled yolov8n.pt when requested.
        if model_file == "yolov8n.pt" and MODEL_PATH.exists():
            model_file = str(MODEL_PATH)

        MODEL_CACHE[model_name] = YOLO(model_file)

    return MODEL_CACHE[model_name]


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "python-yolo",
    })


@app.post("/detect")
def detect():
    if "image" not in request.files:
        return jsonify({
            "message": "Missing image file"
        }), 400

    image = request.files["image"]

    if not image.filename:
        return jsonify({
            "message": "Image filename is missing"
        }), 400

    try:
        confidence = float(request.form.get("confidence", "0.25"))
    except ValueError:
        confidence = 0.25

    model_name = request.form.get("model", "yolov8n")

    # Keep confidence in a sensible range.
    confidence = max(0.0, min(1.0, confidence))

    filename = Path(image.filename).name
    image_path = UPLOAD_DIR / filename

    image.save(image_path)

    started = time.perf_counter()

    try:
        model = get_model(model_name)

        results = model.predict(
    source=str(image_path),
    conf=confidence,
    imgsz=320,
    device="cpu",
    max_det=50,
    verbose=False,
)
        detections = []

        for result in results:
            names = result.names

            if result.boxes is None:
                continue

            for box in result.boxes:
                class_id = int(box.cls[0].item())
                score = float(box.conf[0].item())

                coordinates = [
                    float(value)
                    for value in box.xyxy[0].tolist()
                ]

                detections.append({
                    "label": names[class_id],
                    "confidence": score,
                    "bbox": coordinates,
                })

        processing_time = round(
            (time.perf_counter() - started) * 1000,
            2,
        )

        return jsonify({
            "objects": detections,
            "image": filename,
            "processingTime": processing_time,
            "model": model_name,
        })

    except Exception as exc:
        return jsonify({
            "message": f"YOLO inference failed: {exc}"
        }), 500

    finally:
        # Remove the temporary uploaded image.
        try:
            os.remove(image_path)
        except OSError:
            pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False,
    )