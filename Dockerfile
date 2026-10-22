FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.base.json tsconfig.server.json tsconfig.client.json ./
COPY server.ts ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public
COPY data ./data
COPY exports ./exports

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/exports ./exports

EXPOSE 3000

CMD ["node", "dist/server.js"]
