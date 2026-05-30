FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY lib ./lib
COPY public ./public
COPY data ./data
COPY exports ./exports
COPY server.js ./server.js

EXPOSE 3000

CMD ["npm", "start"]
