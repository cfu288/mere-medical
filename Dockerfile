FROM node:20.19.0 AS deps

WORKDIR /app
COPY package*.json /app/
RUN npm ci


FROM deps AS build-api-stage

COPY . /app/
# Increase Node memory limit for production build
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Disable Nx daemon in Docker builds
ENV NX_DAEMON=false
RUN npx nx run api:build:production

RUN curl -sf https://gobinaries.com/tj/node-prune | sh
RUN npm prune --production
RUN node-prune


FROM deps AS build-web-stage

ARG IS_DEMO=disabled
ENV IS_DEMO=${IS_DEMO}

COPY . /app/
COPY ./nginx.conf /nginx.conf
# Increase Node memory limit for production build
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Disable Nx daemon in Docker builds
ENV NX_DAEMON=false
RUN npx nx test web --configuration=ci
# RUN npx nx run web-e2e:e2e --configuration=ci
RUN npx nx run web:build:production --verbose


# Package React App and API together
FROM node:18-alpine

ARG MERE_APP_VERSION=unknown
ENV MERE_APP_VERSION=${MERE_APP_VERSION}

WORKDIR /app

COPY --from=build-web-stage /app/dist/apps/web/ /app/web/
COPY --from=build-api-stage /app/dist/apps/api/ /app/api/
COPY --from=build-api-stage /app/node_modules/ /app/node_modules/
COPY ./healthcheck.js /app/healthcheck.js

ENV NODE_ENV production

CMD ["node", "api/main.js"]
