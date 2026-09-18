FROM node:26.9-bookworm@sha256:acb7243cabea678dc927ec9020c633d3d82b37b86b1bbcd49dd3f95f6b77ba89 AS deps

WORKDIR /app
COPY package*.json /app/
RUN npm ci


FROM node:26.9-bookworm@sha256:acb7243cabea678dc927ec9020c633d3d82b37b86b1bbcd49dd3f95f6b77ba89 AS prod-deps

WORKDIR /app
COPY package*.json /app/
RUN npm ci --omit=dev


FROM deps AS build-api-stage

COPY . /app/
# Increase Node memory limit for production build
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Disable Nx daemon in Docker builds
ENV NX_DAEMON=false
RUN npx nx test api --configuration=ci
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
RUN npx nx test web --configuration=ci
# RUN npx nx run web-e2e:e2e --configuration=ci
RUN npx nx run web:build:production --verbose


# Package React App and API together
FROM node:26.9-alpine@sha256:dbaa92e5758cbbcf85d65d5403fdb530fe3442cbe8c6dbfb7ef23365450d5070

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

USER 1000
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "/app/healthcheck.js"]

CMD ["node", "api/main.js"]
