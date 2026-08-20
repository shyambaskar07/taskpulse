# Backend Dockerfile for TaskPulse REST API & Worker Engine
FROM node:22-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
COPY backend/tsconfig.json ./
RUN npm install

COPY backend/src ./src
RUN ./node_modules/.bin/tsc

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/server.js"]
