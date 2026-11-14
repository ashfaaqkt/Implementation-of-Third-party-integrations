# ---------------------------------------------------------------------------
# Fleet Management System – Third-party Integrations, API Gateway
# Author : Ashfaaq Feroz Muhammad | BITS ID: 2023EBCS005
# Course : Backend and API Development – BITS Pilani
# File   : Dockerfile – one image for every service; docker-compose picks the command
# ---------------------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
# Docker uses the mongo container, so skip downloading the mongodb-memory-server binary.
ENV MONGOMS_DISABLE_POSTINSTALL=1

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY gateway/package.json gateway/
COPY services/user-service/package.json services/user-service/
COPY services/vehicle-service/package.json services/vehicle-service/
COPY services/telemetry-service/package.json services/telemetry-service/
COPY services/geo-service/package.json services/geo-service/
COPY services/notification-service/package.json services/notification-service/
RUN npm ci --omit=dev

COPY shared shared
COPY gateway gateway
COPY services services
COPY public public
COPY scripts scripts

LABEL org.opencontainers.image.title="Fleet Management System" \
      org.opencontainers.image.authors="Ashfaaq Feroz Muhammad (2023EBCS005)"

EXPOSE 8080
# Default: everything in one process (same as `npm run start:all`)
CMD ["node", "scripts/start-all.js"]
