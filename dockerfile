# Stage 1: build the React app
FROM node:22-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: run the Express server
FROM node:22-bookworm-slim
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV PORT=3001
ENV DB_PATH=/data/shop.db
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
CMD ["node", "index.js"]