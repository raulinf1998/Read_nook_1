# --- Stage 1: Build frontend ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: Backend + static serving ---
FROM node:20-alpine

WORKDIR /app

# Install backend deps
COPY server/package.json ./
RUN npm install --production

# Copy backend code
COPY server/index.js ./

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Create data directory for persistence
RUN mkdir -p /app/data

EXPOSE 3001

ENV DATA_DIR=/app/data
ENV PORT=3001

CMD ["node", "index.js"]
