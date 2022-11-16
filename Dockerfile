FROM node:18 as build-api-stage

WORKDIR /app
COPY package*.json /app/
RUN npm install 
COPY . /app/
RUN npx nx build api:build:production  

RUN curl -sf https://gobinaries.com/tj/node-prune | sh
RUN npm prune --production
RUN node-prune

FROM node:18 as build-web-stage

WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY ./ /app/
COPY ./nginx.conf /nginx.conf
RUN npx nx build web --prod

RUN curl -sf https://gobinaries.com/tj/node-prune | sh
RUN npm prune --production
RUN node-prune


# Package React App and API together
FROM node:18-alpine

WORKDIR /app

RUN apk update && apk add gettext
ENV JSFOLDER=/app/web/*.js

COPY --from=build-web-stage /app/dist/apps/web/ /app/web/
COPY --from=build-api-stage /app/dist/apps/api/ /app/api/
COPY --from=build-api-stage /app/node_modules/ /app/node_modules/

COPY ./inject-env-and-start.sh /usr/bin/inject-env-and-start.sh
RUN chmod +x /usr/bin/inject-env-and-start.sh
ENTRYPOINT [ "inject-env-and-start.sh" ]
