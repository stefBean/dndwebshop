FROM node:22-bookworm-slim
WORKDIR /preview
COPY --chown=node:node server.mjs ./
USER node
EXPOSE 8081
CMD ["node", "--max-old-space-size=32", "server.mjs"]
