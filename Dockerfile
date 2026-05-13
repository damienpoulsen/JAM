FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ffmpeg curl \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY scripts/requirements-prototype.txt /app/scripts/requirements-prototype.txt
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r /app/scripts/requirements-prototype.txt \
    && pip install --no-cache-dir fastapi "uvicorn[standard]" python-multipart
RUN pip install --no-cache-dir --upgrade yt-dlp

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=10000
# Route analysis through the persistent Python server so librosa/lv-chordia
# are loaded once at startup instead of cold-started on every request.
ENV ANALYSIS_API_URL=http://localhost:8001

EXPOSE 10000

# Start the analysis service in the background, wait for it to be ready,
# then start Next.js. The analysis server binds to 8001 to avoid conflicts.
CMD ["sh", "-c", "\
  uvicorn app:app --app-dir /app/analysis-service --host 0.0.0.0 --port 8001 --workers 1 & \
  ANALYSIS_PID=$! && \
  echo 'Waiting for analysis service...' && \
  until curl -sf http://localhost:8001/health > /dev/null 2>&1; do sleep 2; done && \
  echo 'Analysis service ready' && \
  npm start -- --hostname 0.0.0.0 --port ${PORT} \
"]
