# CV-TRUST Backend — API Contract

> **For the frontend team.** This document describes every endpoint, its request format, and response shape.  
> Base URL: `http://localhost:3000/api`

---

## Response Envelope

All endpoints return JSON in this shape:

```json
{
  "success": true,
  "message": "CV-TRUST backend is running",
  "status": "OK",
  "data": { ... },
  "meta": { "timestamp": "2026-09-02T14:00:00.000Z" }
}
```

Errors:
```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "Human-readable message" },
  "meta": { "timestamp": "..." }
}
```

---

## 1. Health

### `GET /api/health`

No auth. No body.

**Response 200:**
```json
{
  "success": true,
  "message": "CV-TRUST backend is running",
  "status": "OK",
  "data": {
    "status": "OK",
    "uptime": 42,
    "version": "0.1.0",
    "timestamp": "2026-09-02T14:00:00.000Z",
    "services": {
      "mongodb": "up",
      "pythonService": "down"
    }
  },
  "meta": { "timestamp": "2026-09-02T14:00:00.000Z" }
}
```

`status` is one of: `"OK"` | `"PARTIAL"` | `"DEGRADED"`

---

## 2. YOLO Object Detection

### `POST /api/detect`

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `image` | File | ✅ | Image file (JPEG, PNG, WebP, BMP, GIF) — max 50 MB |
| `confidence` | number | ❌ | Min confidence threshold, 0–1, default `0.25` |
| `model` | string | ❌ | YOLO variant: `yolov8n` (default), `yolov8s`, `yolov8m` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "objects": [
      { "label": "vehicle", "confidence": 0.94, "bbox": [x1, y1, x2, y2] }
    ],
    "image": "sample.jpg",
    "savedAs": "upload-1234.jpg",
    "processingTime": 312,
    "modelUsed": "yolov8n",
    "rawCount": 3
  }
}
```

**Error responses:**
- `400 NO_FILE` — no image field in request
- `400 INVALID_FILE_TYPE` — unsupported MIME type
- `413 FILE_TOO_LARGE` — upload exceeds `MAX_FILE_SIZE`
- `503 PYTHON_SERVICE_UNAVAILABLE` — Python service not reachable
- `504 PYTHON_SERVICE_TIMEOUT` — Python service timed out
- `502 PYTHON_RESPONSE_FORMAT_ERROR` — Python returned unexpected format

---

## 3. Model Verification

### `POST /api/models/verify`

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `modelPath` | string | ✅ | Server-side path to the model file |
| `trustedHash` | string | ❌ | Known-good SHA-256 hex (64 chars). Omit to just compute hash. |
| `framework` | string | ❌ | Optional framework label such as `YOLO`, `PyTorch`, `TensorFlow`. |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "modelName": "yolov8n.pt",
    "modelPath": "/models/yolov8n.pt",
    "currentModelHash": "a1b2c3...64chars",
    "currentHash": "a1b2c3...64chars",
    "trustedHash": "expected...64chars",
    "match": true,
    "status": "VERIFIED",
    "fileSizeBytes": 6238456,
    "verifiedAt": "2026-09-02T14:00:00.000Z"
  }
}
```

`status` is one of: `"VERIFIED"` | `"SUSPICIOUS"` | `"HASH_COMPUTED"` (when no trustedHash provided)

**Error responses:**
- `400` — validation error (trustedHash not 64 hex chars, etc.)
- `404 MODEL_FILE_NOT_FOUND` — path does not exist on server

---

## 4. Inference Integrity

### `POST /api/inference/create`

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `modelId` | string | ✅ | Model identifier string |
| `inputData` | object | ✅ | Input fed to the model |
| `outputData` | object | ✅ | Output produced by the model |
| `config` | object | ❌ | Inference configuration (threshold etc.) |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "inferenceId": "66d1abc...",
    "integrityHash": "sha256hex64...",
    "inputHash": "sha256hex64...",
    "modelHash": "sha256hex64...",
    "configHash": "sha256hex64...",
    "outputHash": "sha256hex64...",
    "timestamp": "2026-09-02T14:00:00.000Z",
    "createdAt": "2026-09-02T14:00:00.000Z"
  }
}
```

### `POST /api/inference/verify`

| Field | Type | Required | Description |
|---|---|---|---|
| `inferenceId` | string | ✅ | The `inferenceId` from /inference/create |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "inferenceId": "66d1abc...",
    "verified": true,
    "status": "VERIFIED",
    "storedHash": "sha256hex64...",
    "currentHash": "sha256hex64...",
    "componentChecks": {
      "input":  { "stored": "...", "current": "...", "match": true },
      "model":  { "stored": "...", "current": "...", "match": true },
      "config": { "stored": "...", "current": "...", "match": true },
      "output": { "stored": "...", "current": "...", "match": true }
    },
    "verifiedAt": "2026-09-02T14:00:00.000Z"
  }
}
```

`status` is one of: `"VERIFIED"` | `"TAMPERING_DETECTED"`

**Error responses:**
- `404 INFERENCE_NOT_FOUND`
- `400` — validation error

---

## 5. Dataset Analysis

### `POST /api/datasets/analyze`

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `datasetPath` | string | ✅ | Server-side path to image directory |
| `options.checkDuplicates` | boolean | ❌ | Default `true` |
| `options.checkAnomalies` | boolean | ❌ | Default `true` |
| `options.usePython` | boolean | ❌ | Default `false`; set `true` only if the Python service exposes `/analyze-dataset`. |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "datasetId": "66d1...",
    "totalImages": 500,
    "uniqueImages": 493,
    "duplicateCount": 7,
    "duplicateGroups": [["img01.jpg", "img01_copy.jpg"]],
    "anomalies": [
      {
        "file": "corrupt_img.jpg",
        "reason": "fileSizeBytes is an outlier; width is an outlier",
        "deviationSigma": 4.2,
        "evidence": { "fileSizeBytes": { "value": 512, "mean": 102400, "median": 100000, "std": 20480 } }
      }
    ],
    "featureSummary": {
      "fileSizeBytes": { "mean": 102400, "min": 512, "max": 204800 },
      "width": { "mean": 640, "min": 320, "max": 1920 },
      "height": { "mean": 480, "min": 240, "max": 1080 }
    },
    "suspiciousCount": 1,
    "riskScore": 0.071,
    "integrityStatus": "DUPLICATES_FOUND",
    "findings": [...],
    "source": "node"
  }
}
```

`integrityStatus`: `"CLEAN"` | `"DUPLICATES_FOUND"` | `"ANOMALIES_FOUND"` | `"MIXED"` | `"ERROR"`

**Error responses:**
- `404 DATASET_NOT_FOUND`
- `400 NOT_A_DIRECTORY`

---

## 6. Distribution Shift

### `POST /api/shift/analyze`

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `referenceValues` | object | ✅ | Baseline numeric statistics |
| `incomingValues` | object | ✅ | Current numeric statistics |
| `referenceDatasetPath` | string | ✅* | Server-side path to reference image dataset |
| `incomingDatasetPath` | string | ✅* | Server-side path to incoming image dataset |
| `metrics` | string[] | ❌ | Subset of keys to compare. Omit to compare all shared keys. |

Send either `referenceValues` + `incomingValues`, or `referenceDatasetPath` + `incomingDatasetPath`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "shiftDetected": true,
    "shiftScore": 0.4167,
    "status": "HIGH",
    "features": {
      "brightness": 0.5,
      "width": 0.1
    },
    "details": {
      "keysCompared": 3,
      "metrics": {
        "brightness": { "reference": 120, "incoming": 180, "absoluteDifference": 60, "relativeDeviation": 0.5 }
      }
    },
    "analysedAt": "2026-09-02T14:00:00.000Z"
  }
}
```

`status`: `"NORMAL"` | `"MODERATE"` | `"HIGH"`

---

## 7. Findings

### `GET /api/findings`

**Query parameters:**

| Param | Description |
|---|---|
| `type` | `DUPLICATE` \| `ANOMALY` \| `HASH_MISMATCH` \| `TAMPERING` \| `DRIFT` \| `OTHER` |
| `severity` | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` |
| `status` | `OPEN` \| `RESOLVED` \| `SUPPRESSED` |
| `source` | `dataset_analysis` \| `model_verification` \| `inference_check` \| `shift_analysis` |
| `page` | Default `1` |
| `limit` | Default `20`, max `100` |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "type": "DUPLICATE",
      "severity": "MEDIUM",
      "status": "OPEN",
      "source": "dataset_analysis",
      "reason": "7 duplicate images found",
      "evidence": { ... },
      "confidence": 1.0,
      "createdAt": "2026-09-02T14:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
}
```

---

## 8. Reports

### `GET /api/reports/:id`

No auth. No request body.

Use a MongoDB report ID to retrieve an existing report. Use `/api/reports/latest` to generate and store a fresh report from the currently stored OPEN findings.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "_id": "66d1...",
    "title": "CV-TRUST Assurance Report",
    "overallRisk": "HIGH",
    "riskScore": 0.75,
    "recommendation": "QUARANTINE",
    "summary": "5 finding(s) detected. Risk level: HIGH.",
    "findingIds": ["...", "..."],
    "findings": [...],
    "affectedAssets": [...],
    "createdAt": "2026-09-02T14:00:00.000Z"
  }
}
```

`recommendation`: `"ACCEPT"` | `"REVIEW"` | `"QUARANTINE"`

**Error responses:**
- `404 REPORT_NOT_FOUND`
- `400 INVALID_ID`
- `503 DATABASE_UNAVAILABLE`

---

## 9. Audit Logs

### `GET /api/audit-logs`

**Query parameters:**

| Param | Description |
|---|---|
| `action` | Filter by action type (e.g., `INFERENCE_VERIFIED`) |
| `from` | ISO date string — start of range |
| `to` | ISO date string — end of range |
| `page` | Default `1` |
| `limit` | Default `50`, max `200` |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "action": "INFERENCE_CREATED",
      "user": "system",
      "relatedId": "66d1...",
      "relatedType": "inference",
      "result": "SUCCESS",
      "details": { ... },
      "previousHash": "a1b2c3...",
      "eventHash": "d4e5f6...",
      "timestamp": "2026-09-02T14:00:00.000Z",
      "createdAt": "2026-09-02T14:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 12, "pages": 1 }
}
```

**Possible `action` values:**
- `DATASET_ANALYZED`
- `MODEL_VERIFIED`
- `INFERENCE_CREATED`
- `INFERENCE_VERIFIED`
- `REPORT_GENERATED`
- `DETECTION_RUN`
- `SHIFT_ANALYZED`
- `FINDING_CREATED`

---

## Common HTTP Error Codes

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body/query failed validation |
| 400 | `NO_FILE` | Required file upload missing |
| 400 | `INVALID_FILE_TYPE` | Unsupported MIME type |
| 400 | `NOT_A_FILE` / `NOT_A_DIRECTORY` | Path type mismatch |
| 400 | `INVALID_ID` | Invalid MongoDB ObjectId |
| 413 | `FILE_TOO_LARGE` | Uploaded file exceeds configured size limit |
| 404 | `NOT_FOUND` | Route doesn't exist |
| 404 | `*_NOT_FOUND` | Resource not found by ID |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 502 | `PYTHON_RESPONSE_FORMAT_ERROR` | Python returned unexpected shape |
| 503 | `PYTHON_SERVICE_UNAVAILABLE` | Python service not running |
| 503 | `DATABASE_UNAVAILABLE` | Endpoint requires MongoDB but no connection is available |
| 504 | `PYTHON_SERVICE_TIMEOUT` | Python service did not respond before timeout |
