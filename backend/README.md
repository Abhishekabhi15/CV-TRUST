# CV-TRUST Backend

Computer Vision Trust Verification System — Backend API

## Prerequisites

- Node.js ≥ 18
- MongoDB (local) — `mongodb://localhost:27017/cvtrust`
- Python/YOLO service running at `PYTHON_SERVICE_URL` (optional for all endpoints except `/api/detect`; backend reports dependency status in health)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env if your MongoDB URI or Python service URL differs

# 3. Start MongoDB (if not already running)
mongod --dbpath /usr/local/var/mongodb    # macOS with brew
# or
mongod                                     # default data directory

# 4. Start the backend (dev mode with hot-reload)
npm run dev

# 5. Verify it's running
curl http://localhost:3000/api/health
```

## Environment Variables

See [.env.example](.env.example) for all variables with defaults.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `MONGODB_URI` | `mongodb://localhost:27017/cvtrust` | MongoDB connection string |
| `PYTHON_SERVICE_URL` | `http://localhost:5000` | Python/YOLO service base URL. On macOS, port 5000 may be occupied by AirTunes; use the actual Python team's port. |
| `PYTHON_SERVICE_TIMEOUT` | `30000` | Timeout in ms for Python calls |
| `MAX_FILE_SIZE` | `52428800` | Max upload size in bytes (50 MB) |
| `LOG_LEVEL` | `debug` | Winston log level |

## Running Tests

```bash
npm test                        # all tests
npm run test:health             # health endpoint only
npx jest tests/inference.test.js   # inference integrity only
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server health + dependency status |
| POST | `/api/detect` | YOLO object detection (multipart/form-data) |
| POST | `/api/models/verify` | SHA-256 model integrity verification |
| POST | `/api/inference/create` | Create tamper-evident inference record |
| POST | `/api/inference/verify` | Verify inference — `VERIFIED` or `TAMPERING_DETECTED` |
| POST | `/api/datasets/analyze` | Duplicate + anomaly detection on dataset |
| POST | `/api/shift/analyze` | Distribution shift analysis |
| GET | `/api/findings` | Retrieve real stored findings (filterable) |
| GET | `/api/reports/:id` | Retrieve a report by ID, or use `/api/reports/latest` to generate from current findings |
| GET | `/api/audit-logs` | Retrieve tamper-evident audit log |

See [API_CONTRACT.md](API_CONTRACT.md) for full request/response documentation.

## Architecture

```
routes → controllers → services → models (Mongoose)
                    ↘ utils (hash, logger, AppError)
                    ↘ middleware (upload, validate, errorHandler)
```

## Node → Python Communication

The Node backend calls the Python service via HTTP (`axios`):

```
POST /api/detect → yolo.service.js → axios.post(PYTHON_SERVICE_URL/detect) → normalised response
```

If the Python service is unavailable or rejects the request, Node returns a structured error such as `503 PYTHON_SERVICE_UNAVAILABLE`, `504 PYTHON_SERVICE_TIMEOUT`, or `PYTHON_SERVICE_ERROR`.

## MongoDB Collections

| Collection | Purpose |
|---|---|
| `inferences` | Tamper-evident inference records |
| `findings` | Risk/anomaly findings from all analysis types |
| `reports` | Assurance reports aggregating findings |
| `auditlogs` | Hash-chained audit trail |
| `datasets` | Dataset analysis results |
| `assets` | Top-level tracked entities |
| `models` | SHA-256 model verification records |

## Postman Collection

Import [`postman/cvtrust-backend.postman_collection.json`](postman/cvtrust-backend.postman_collection.json) into Postman.

Set the `base_url` variable to `http://localhost:3000/api`.

Each request has automated assertions. Run in order for the full end-to-end demo.
