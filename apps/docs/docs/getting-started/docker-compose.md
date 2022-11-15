---
sidebar_position: 1
---

# Run on Docker Compose

These instructions will tell you how to get Mari Medical up and running with Docker Compose.

As Mari Medical is still being developed, so is this documentation. Complete documentation is coming soon!

## What you'll need

- Docker

### Setting Up

Copy the following a docker compose file in a new directory. Note that the directory name becomes the prefix for the container. You'll need to replace items in the file that have the format `${VARIABLE_NAME}` with the actual value. Check out the [docker documentation](https://docs.docker.com/compose/environment-variables/#substitute-environment-variables-in-compose-files) for more information on how to do this securely.

To get the env variables needed for OnPatient functionality, [see our documentation here](./onpatient-setup).

```yaml title="docker-compose.yaml"
version: '3.9'

services:
  web:
    image: registry.mari.casa/mari-medical-web:latest
    ports:
      - '4200:80'
    environment:
      - ONPATIENT_REDIRECT_URI=${ONPATIENT_REDIRECT_URI}
      - ONPATIENT_CLIENT_ID=${ONPATIENT_CLIENT_ID}
      - DATABASE_NAME=${DATABASE_NAME}
      - PUBLIC_URL=${PUBLIC_URL}
  api:
    image: registry.mari.casa/mari-medical-api:latest
    ports:
      - '4201:4201'
    environment:
      - ONPATIENT_CLIENT_SECRET=${ONPATIENT_CLIENT_SECRET}
      - ONPATIENT_CLIENT_ID=${ONPATIENT_CLIENT_ID}
      - ONPATIENT_REDIRECT_URI=${ONPATIENT_REDIRECT_URI}
      - PUBLIC_URL=${PUBLIC_URL}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up --detach`

Then open `http://localhost:4200` in a browser to see Mari Medical running!
