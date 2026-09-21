FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node server/src ./src
COPY --chown=node:node src/lib /app/src/lib
COPY --chown=node:node src/types /app/src/types
COPY --chown=node:node src/features/lectures/types.ts /app/src/features/lectures/types.ts
COPY --chown=node:node src/features/study /app/src/features/study
USER node
EXPOSE 3001
CMD ["node", "src/index.ts"]
