FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ffmpeg curl git \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Build the bgutil PO-token server (Node.js) — generates YouTube proof-of-origin tokens
# that yt-dlp needs to download from server/datacenter IPs.
RUN git clone --depth=1 --branch 1.3.1 \
      https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil \
    && cd /opt/bgutil/server \
    && npm ci \
    && npx tsc

COPY package.json package-lock.json ./
RUN npm ci

COPY scripts/requirements-prototype.txt /app/scripts/requirements-prototype.txt
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r /app/scripts/requirements-prototype.txt \
    && pip install --no-cache-dir fastapi "uvicorn[standard]" python-multipart
RUN pip install --no-cache-dir --upgrade yt-dlp pytubefix bgutil-ytdlp-pot-provider

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=10000
ENV ANALYSIS_API_URL=http://localhost:8001

EXPOSE 10000

# Start order:
# 1. bgutil PO-token server (port 4416) — yt-dlp plugin auto-discovers it
# 2. Python analysis service (port 8001)
# 3. Next.js (port $PORT)
CMD ["sh", "-c", "\
  node /opt/bgutil/server/build/main.js & \
  uvicorn app:app --app-dir /app/analysis-service --host 0.0.0.0 --port 8001 --workers 1 & \
  echo 'Waiting for analysis service...' && \
  until curl -sf http://localhost:8001/health > /dev/null 2>&1; do sleep 2; done && \
  echo 'Analysis service ready' && \
  npm start -- --hostname 0.0.0.0 --port ${PORT} \
"]
