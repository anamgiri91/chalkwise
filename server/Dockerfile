# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATABASE_CA_FILE=/app/rds-ca.pem
# Public AWS trust anchors, verified September 24, 2026. A changed upstream bundle
# fails the build until its certificates and checksum have been reviewed again.
ADD --checksum=sha256:e5bb2084ccf45087bda1c9bffdea0eb15ee67f0b91646106e466714f9de3c7e3 --chmod=0444 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/rds-ca.pem
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3001') + '/health/live', { signal: AbortSignal.timeout(4000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/index.ts"]
