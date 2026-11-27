FROM node:26.13.0-bookworm@sha256:a546d3f8acd2af4382668a7e6acd3bc4418e6a27478373e3246f8162f5181509 AS deps

WORKDIR /app
COPY package*.json /app/
RUN npm ci


FROM node:26.13.0-bookworm@sha256:a546d3f8acd2af4382668a7e6acd3bc4418e6a27478373e3246f8162f5181509 AS prod-deps

WORKDIR /app
COPY package*.json /app/
RUN npm ci --omit=dev


FROM deps AS build-api-stage

COPY . /app/
# Increase Node memory limit for production build
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Disable Nx daemon in Docker builds
ENV NX_DAEMON=false
RUN npx nx test api --configuration=ci --maxWorkers=2
RUN npx nx run api:build:production


FROM deps AS build-web-stage

ARG IS_DEMO=disabled
ENV IS_DEMO=${IS_DEMO}
ARG MERE_APP_VERSION=unknown
ENV MERE_APP_VERSION=${MERE_APP_VERSION}

COPY . /app/
# Increase Node memory limit for production build
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Disable Nx daemon in Docker builds
ENV NX_DAEMON=false
RUN npx nx test web --configuration=ci --maxWorkers=2
# RUN npx nx run web-e2e:e2e --configuration=ci
RUN npx nx run web:build:production --verbose


# Package React App and API together
FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5

ARG MERE_APP_VERSION=unknown
ENV MERE_APP_VERSION=${MERE_APP_VERSION}
ENV NODE_ENV=production

LABEL org.opencontainers.image.title="Mere Medical" \
      org.opencontainers.image.source="https://github.com/cfu288/mere-medical" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY --from=build-web-stage /app/dist/apps/web/ /app/web/
COPY --from=build-api-stage /app/dist/apps/api/ /app/api/
COPY --from=prod-deps /app/node_modules/ /app/node_modules/
COPY ./healthcheck.js /app/healthcheck.js
COPY --chmod=755 ./bin/ /app/bin/
ENV PATH=/app/bin:$PATH

USER 1000
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "/app/healthcheck.js"]

CMD ["node", "api/main.js"]
