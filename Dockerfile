FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY --from=build /app/dist ./dist/
COPY public/ ./public/

RUN mkdir -p /data && chown appuser:appgroup /data

USER appuser

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DB_PATH=/data/portfolio.db
ENV TOKEN_PATH=/data/.auth-token

EXPOSE 3000

CMD ["node", "server/index.js"]
