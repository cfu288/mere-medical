FROM node:16.14.0 as build-api-stage

WORKDIR /app
COPY package*.json /app/
RUN npm install 
COPY . /app/
RUN npx nx build api:build:production --prod

RUN curl -sf https://gobinaries.com/tj/node-prune | sh
RUN npm prune --production
RUN node-prune


FROM node:16.14.0 as build-web-stage

WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY ./ /app/
COPY ./nginx.conf /nginx.conf
RUN npx nx build web:build:production


# Package React App and API together
FROM node:16.14.0-alpine

WORKDIR /app

RUN apk update && apk add --no-cache gettext moreutils
ENV JSFOLDER=/app/web/*.js

COPY --from=build-web-stage /app/dist/apps/web/ /app/web/
COPY --from=build-api-stage /app/dist/apps/api/ /app/api/
COPY --from=build-api-stage /app/node_modules/ /app/node_modules/

COPY ./healthcheck.js /app/healthcheck.js

COPY ./inject-env-and-start.sh /usr/bin/inject-env-and-start.sh
RUN chmod +x /usr/bin/inject-env-and-start.sh

ENTRYPOINT [ "inject-env-and-start.sh" ]
