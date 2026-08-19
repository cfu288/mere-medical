FROM node:24.19.0-bookworm@sha256:934240a162082fd8b8a2f90cd5114446443f1eba1c5378f6687167ca405e6584 AS deps

WORKDIR /app
COPY package*.json /app/
RUN npm ci


FROM node:24.19.0-bookworm@sha256:934240a162082fd8b8a2f90cd5114446443f1eba1c5378f6687167ca405e6584 AS prod-deps

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
FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43

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
