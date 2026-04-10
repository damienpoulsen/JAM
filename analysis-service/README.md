# JAM Analysis Service

Small Python API for BPM, beat-start, key, and chord analysis.

## Local run

```bash
pip install -r analysis-service/requirements.txt
uvicorn app:app --app-dir analysis-service --reload --port 8000
```

## Endpoint

`POST /analyze`

Multipart form fields:

- `songId`
- `detectChords` (`true` / `false`)
- `skipBpm` (`true` / `false`)
- `file`

## Frontend wiring

Set `ANALYSIS_API_URL` in the Next app to the deployed backend URL.

Example:

```env
ANALYSIS_API_URL=https://your-analysis-service.example.com
```
