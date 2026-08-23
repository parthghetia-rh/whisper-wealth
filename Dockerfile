FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm test && npm run build

FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY --from=build /app/dist ./dist/
COPY public/ ./public/

RUN mkdir -p /data /backups && chown appuser:appgroup /data /backups

USER appuser

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DB_PATH=/data/portfolio.db
ENV TOKEN_PATH=/data/.auth-token

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
