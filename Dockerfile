FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY scripts/requirements-prototype.txt /app/scripts/requirements-prototype.txt
RUN pip3 install --no-cache-dir -r /app/scripts/requirements-prototype.txt

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["sh", "-c", "npm start -- --hostname 0.0.0.0 --port ${PORT}"]
