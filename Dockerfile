FROM node:20.11.0 as build-api-stage

WORKDIR /app
COPY package*.json /app/
RUN npm ci 
COPY . /app/
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

COPY --from=build-web-base . .
WORKDIR /app
RUN npx nx test web --configuration=ci
# RUN npx nx run web-e2e:e2e --configuration=ci
RUN npx nx run web:build:production


# Package React App and API together
FROM node:18-alpine

WORKDIR /app

RUN apk update && apk add --no-cache gettext moreutils
ENV JSFOLDER=/app/web/*.js

COPY --from=build-web-stage /app/dist/apps/web/ /app/web/
COPY --from=build-api-stage /app/dist/apps/api/ /app/api/
COPY --from=build-api-stage /app/node_modules/ /app/node_modules/

COPY ./healthcheck.js /app/healthcheck.js

COPY ./inject-env-and-start.sh /usr/bin/inject-env-and-start.sh
RUN chmod +x /usr/bin/inject-env-and-start.sh

ENV NODE_ENV production

ENTRYPOINT [ "inject-env-and-start.sh" ]
