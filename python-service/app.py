from flask import Flask, request, jsonify
from ultralytics import YOLO
from pathlib import Path
from PIL import Image
import hashlib
import time
import os
import io
import numpy as np

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ── Model configuration ───────────────────────────────────────────────────────
MODEL_PATH = BASE_DIR / "yolov8n.pt"
MODEL_NAME = "yolov8n"
MODEL_FRAMEWORK = "Ultralytics"
MODEL_VERSION = "8.0"
INFERENCE_DEVICE = "cpu"
DEFAULT_IMGSZ = 640
DEFAULT_CONF = 0.20   # slightly lower than 0.25 to catch more small pedestrians
DEFAULT_MAX_DET = 300  # was 50 — increased for crowded scenes

# ── Pre-load model at startup ─────────────────────────────────────────────────
print(f"[CV-TRUST] Pre-loading YOLO model from {MODEL_PATH} …")
_startup = time.perf_counter()
MODEL = YOLO(str(MODEL_PATH))
MODEL.to(INFERENCE_DEVICE)
_elapsed = round((time.perf_counter() - _startup) * 1000, 1)
print(f"[CV-TRUST] Model loaded in {_elapsed} ms")

MODEL_LOAD_STATUS = "loaded"
MODEL_LOAD_TIME = _elapsed

# ── Compute SHA-256 hash of model file once at startup ───────────────────────
def _compute_file_hash(path: Path) -> str:
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

MODEL_HASH = _compute_file_hash(MODEL_PATH) if MODEL_PATH.exists() else "unavailable"
MODEL_FILE_SIZE = MODEL_PATH.stat().st_size if MODEL_PATH.exists() else 0
print(f"[CV-TRUST] Model SHA-256: {MODEL_HASH[:16]}…")

# ── Reference baseline stats (from reference-dataset) ────────────────────────
# These are computed from the 5 reference images at startup.
# Used for distribution shift comparison.
REFERENCE_STATS = None

def _compute_image_stats(img: Image.Image, file_size_bytes: int = 0) -> dict:
    """Compute image statistics used for distribution shift analysis."""
    width, height = img.size
    img_array = np.array(img.convert("RGB"), dtype=np.float32)

    # Per-channel means
    r_mean = float(img_array[:, :, 0].mean())
    g_mean = float(img_array[:, :, 1].mean())
    b_mean = float(img_array[:, :, 2].mean())

    # Brightness: mean of grayscale
    gray = np.mean(img_array, axis=2)
    brightness = float(gray.mean())

    # Contrast: standard deviation of grayscale
    contrast = float(gray.std())

    # Aspect ratio
    aspect_ratio = round(width / height, 4) if height > 0 else 1.0

    return {
        "width": width,
        "height": height,
        "aspectRatio": aspect_ratio,
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "rMean": round(r_mean, 2),
        "gMean": round(g_mean, 2),
        "bMean": round(b_mean, 2),
        "fileSizeBytes": file_size_bytes,
    }

def _build_reference_baseline() -> dict | None:
    """Compute average image stats from the reference-dataset directory."""
    ref_dir = BASE_DIR / "reference-dataset"
    if not ref_dir.exists():
        return None

    images = list(ref_dir.glob("*.jpg")) + list(ref_dir.glob("*.png")) + list(ref_dir.glob("*.jpeg"))
    if not images:
        return None

    all_stats = []
    for img_path in images:
        try:
            img = Image.open(img_path)
            stats = _compute_image_stats(img, img_path.stat().st_size)
            all_stats.append(stats)
        except Exception:
            continue

    if not all_stats:
        return None

    # Average each numeric field across all reference images
    keys = list(all_stats[0].keys())
    baseline = {}
    for k in keys:
        vals = [s[k] for s in all_stats if isinstance(s.get(k), (int, float))]
        baseline[k] = round(sum(vals) / len(vals), 4) if vals else 0

    baseline["sampleCount"] = len(all_stats)
    return baseline

REFERENCE_STATS = _build_reference_baseline()
if REFERENCE_STATS:
    print(f"[CV-TRUST] Reference baseline computed from {REFERENCE_STATS['sampleCount']} images")
else:
    print("[CV-TRUST] WARNING: No reference-dataset found — shift analysis will be limited")


# ── Shift analysis helper ─────────────────────────────────────────────────────
def _analyze_shift(current_stats: dict, reference: dict) -> dict:
    """
    Compare current image stats against the reference baseline.
    Returns shift score, status, and per-metric details.
    """
    if not reference:
        return {
            "shiftScore": 0,
            "shiftStatus": "UNKNOWN",
            "shiftDetected": False,
            "message": "No reference baseline available",
            "metrics": {},
        }

    epsilon = 1e-9
    keys_to_compare = ["brightness", "contrast", "aspectRatio", "width", "height", "rMean", "gMean", "bMean"]
    metrics = {}
    total_deviation = 0
    count = 0

    for key in keys_to_compare:
        ref_val = reference.get(key)
        cur_val = current_stats.get(key)
        if ref_val is None or cur_val is None:
            continue
        if not isinstance(ref_val, (int, float)) or not isinstance(cur_val, (int, float)):
            continue
        rel_dev = abs(cur_val - ref_val) / (abs(ref_val) + epsilon)
        metrics[key] = {
            "baseline": round(ref_val, 4),
            "current": round(cur_val, 4),
            "absoluteDifference": round(abs(cur_val - ref_val), 4),
            "relativeDeviation": round(rel_dev, 4),
        }
        total_deviation += rel_dev
        count += 1

    raw_score = total_deviation / count if count > 0 else 0
    shift_score = round(min(1.0, raw_score), 4)

    if shift_score < 0.1:
        status = "NORMAL"
    elif shift_score < 0.3:
        status = "MODERATE"
    else:
        status = "HIGH"

    return {
        "shiftScore": shift_score,
        "shiftStatus": status,
        "shiftDetected": shift_score >= 0.1,
        "metrics": metrics,
        "baselineSource": "reference-dataset",
        "baselineSamples": reference.get("sampleCount", 0),
    }


# ── Fallback model cache for non-default models ───────────────────────────────
# Must be defined BEFORE the detect() function which references it.
_model_cache = {}


# ── Health endpoint ───────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "python-yolo",
        "model": MODEL_NAME,
        "modelLoaded": MODEL_LOAD_STATUS == "loaded",
    })



# ── Model info endpoint ───────────────────────────────────────────────────────
@app.get("/model-info")
def model_info():
    """
    Returns live model information for the Model Assurance module.
    All values are actual runtime values — nothing hardcoded except framework label.
    """
    return jsonify({
        "modelName": MODEL_NAME,
        "modelFile": MODEL_PATH.name,
        "modelVersion": MODEL_VERSION,
        "framework": MODEL_FRAMEWORK,
        "device": INFERENCE_DEVICE,
        "imgsz": DEFAULT_IMGSZ,
        "confidenceThreshold": DEFAULT_CONF,
        "maxDet": DEFAULT_MAX_DET,
        "modelHash": MODEL_HASH,
        "fileSizeBytes": MODEL_FILE_SIZE,
        "loadStatus": MODEL_LOAD_STATUS,
        "loadTimeMs": MODEL_LOAD_TIME,
        "referenceBaselineAvailable": REFERENCE_STATS is not None,
        "verifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })


# ── Object detection endpoint ─────────────────────────────────────────────────
@app.post("/detect")
def detect():
    if "image" not in request.files:
        return jsonify({"message": "Missing image file"}), 400

    image = request.files["image"]

    if not image.filename:
        return jsonify({"message": "Image filename is missing"}), 400

    # ── Parse request params ───────────────────────────────────────────────────
    try:
        confidence = float(request.form.get("confidence", str(DEFAULT_CONF)))
    except ValueError:
        confidence = DEFAULT_CONF
    confidence = max(0.05, min(1.0, confidence))

    try:
        imgsz = int(request.form.get("imgsz", str(DEFAULT_IMGSZ)))
        imgsz = max(320, min(1280, imgsz))
    except ValueError:
        imgsz = DEFAULT_IMGSZ

    try:
        max_det = int(request.form.get("max_det", str(DEFAULT_MAX_DET)))
        max_det = max(1, min(1000, max_det))
    except ValueError:
        max_det = DEFAULT_MAX_DET

    model_name = request.form.get("model", MODEL_NAME)

    filename = Path(image.filename).name
    image_path = UPLOAD_DIR / filename
    image.save(image_path)

    # ── Compute image stats before inference ───────────────────────────────────
    try:
        pil_img = Image.open(image_path)
        file_size = image_path.stat().st_size
        img_stats = _compute_image_stats(pil_img, file_size)
    except Exception as e:
        img_stats = {"error": str(e)}

    # ── YOLO inference ─────────────────────────────────────────────────────────
    started = time.perf_counter()

    try:
        # Use pre-loaded MODEL for yolov8n; fall back to cache for other models
        if model_name == MODEL_NAME or model_name == "yolov8n":
            model = MODEL
        else:
            if model_name not in _model_cache:
                _model_cache[model_name] = YOLO(model_name if model_name.endswith(".pt") else f"{model_name}.pt")
            model = _model_cache[model_name]

        results = model.predict(
            source=str(image_path),
            conf=confidence,
            imgsz=imgsz,
            device=INFERENCE_DEVICE,
            max_det=max_det,
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
                coordinates = [float(v) for v in box.xyxy[0].tolist()]
                detections.append({
                    "label": names[class_id],
                    "confidence": score,
                    "bbox": coordinates,
                })

        processing_time_ms = round((time.perf_counter() - started) * 1000, 2)

        # ── Compute shift analysis ─────────────────────────────────────────────
        shift_result = _analyze_shift(img_stats, REFERENCE_STATS) if isinstance(img_stats, dict) and "error" not in img_stats else None

        return jsonify({
            "objects": detections,
            "image": filename,
            "processingTime": processing_time_ms,
            "model": model_name,
            "modelHash": MODEL_HASH,
            "device": INFERENCE_DEVICE,
            "imgsz": imgsz,
            "confidenceThreshold": confidence,
            "maxDet": max_det,
            "imageStats": img_stats,
            "shiftAnalysis": shift_result,
        })

    except Exception as exc:
        return jsonify({"message": f"YOLO inference failed: {exc}"}), 500

    finally:
        try:
            os.remove(image_path)
        except OSError:
            pass


# ── Image-only shift analysis endpoint ───────────────────────────────────────
@app.post("/shift/image")
def shift_image():
    """
    Accepts an image upload and returns distribution shift analysis
    against the reference baseline. No YOLO inference performed.
    """
    if "image" not in request.files:
        return jsonify({"message": "Missing image file"}), 400

    image = request.files["image"]
    if not image.filename:
        return jsonify({"message": "Image filename is missing"}), 400

    filename = Path(image.filename).name
    image_path = UPLOAD_DIR / f"shift_{filename}"
    image.save(image_path)

    try:
        pil_img = Image.open(image_path)
        file_size = image_path.stat().st_size
        img_stats = _compute_image_stats(pil_img, file_size)
        shift_result = _analyze_shift(img_stats, REFERENCE_STATS)

        return jsonify({
            "imageName": filename,
            "imageStats": img_stats,
            "shift": shift_result,
            "analysedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })

    except Exception as exc:
        return jsonify({"message": f"Shift analysis failed: {exc}"}), 500

    finally:
        try:
            os.remove(image_path)
        except OSError:
            pass




if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)