FROM node:20-slim

# Install yt-dlp + ffmpeg (needed for audio extraction)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip ffmpeg curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get purge -y python3-pip curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

# Create storage directories
RUN mkdir -p storage/music-cache storage/temp storage/yt-dlp-cache

EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "server.js"]
