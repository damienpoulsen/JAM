FROM python:3.11-slim

WORKDIR /app

# gcc/g++ needed to compile madmom's Cython extensions (no Python 3.11 wheel on PyPI)
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ && rm -rf /var/lib/apt/lists/*

COPY analysis-service/requirements.txt /app/requirements.txt
# Install CPU-only torch first so lv-chordia doesn't pull in the full CUDA wheel (~2GB)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY analysis-service /app/analysis-service
COPY scripts /app/scripts

EXPOSE 8000

CMD ["uvicorn", "app:app", "--app-dir", "/app/analysis-service", "--host", "0.0.0.0", "--port", "8000"]
