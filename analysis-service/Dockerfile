FROM python:3.11-slim

WORKDIR /app

COPY analysis-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY analysis-service /app/analysis-service
COPY scripts /app/scripts

EXPOSE 8000

CMD ["uvicorn", "app:app", "--app-dir", "/app/analysis-service", "--host", "0.0.0.0", "--port", "8000"]
