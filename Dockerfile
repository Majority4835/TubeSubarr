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
COPY .env.example ./.env
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push && node dist/src/server.js"]
