FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate
COPY src ./src
COPY docker/entrypoint.sh ./docker/entrypoint.sh
COPY .env.example ./.env
RUN npm run build

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 CMD curl -fsS http://127.0.0.1:4000/health || exit 1
CMD ["/app/docker/entrypoint.sh"]
