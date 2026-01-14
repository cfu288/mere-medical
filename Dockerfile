FROM node:20.11.0 as build-api-stage

WORKDIR /app
COPY package*.json /app/
RUN npm ci 
COPY . /app/
# Increase Node memory limit for production build
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Disable Nx daemon in Docker builds
ENV NX_DAEMON=false
RUN npx nx run api:build:production

RUN curl -sf https://gobinaries.com/tj/node-prune | sh
RUN npm prune --production
RUN node-prune


FROM node:20.11.0 as build-web-base

WORKDIR /app
COPY package*.json /app/
RUN npm ci
COPY ./ /app/
COPY ./nginx.conf /nginx.conf


FROM node:20.11.0 as build-web-stage

ARG IS_DEMO=disabled
ENV IS_DEMO=${IS_DEMO}

COPY --from=build-web-base . .
WORKDIR /app
# Increase Node memory limit for production build
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Disable Nx daemon in Docker builds
ENV NX_DAEMON=false
RUN npx nx test web --configuration=ci
# RUN npx nx run web-e2e:e2e --configuration=ci
RUN npx nx run web:build:production --verbose


# Package React App and API together
FROM node:18-alpine

WORKDIR /app

COPY --from=build-web-stage /app/dist/apps/web/ /app/web/
COPY --from=build-api-stage /app/dist/apps/api/ /app/api/
COPY --from=build-api-stage /app/node_modules/ /app/node_modules/
COPY ./healthcheck.js /app/healthcheck.js

ENV NODE_ENV production

CMD ["node", "--openssl-config=openssl.cnf", "api/main.js"]
