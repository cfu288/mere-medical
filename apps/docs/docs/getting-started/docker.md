---
sidebar_position: 1
---

# Run with Docker

These instructions will tell you how to get Mari Medical up and running with Docker or Docker Compose.

As Mari Medical is still being developed, so is this documentation. Complete documentation is coming soon!

## What you'll need

- Docker

### Setting Up with Docker

Run the following in your command prompt:

```
docker run -p 4200:80 -i -t \
  --name mari-medical \
  -e ONPATIENT_REDIRECT_URI=https://localhost:4200/api/v1/onpatient/callback \
  -e ONPATIENT_CLIENT_ID=<ID_HERE> \
  -e ONPATIENT_CLIENT_SECRET=<SECRET_HERE> \
  -e DATABASE_NAME=mari_db \
  -e PUBLIC_URL=https://localhost:4200 \
  registry.mari.casa/mari-medical:latest
```

Then open `http://localhost:4200` in a browser to see Mari Medical running!

If you'd like to run Mari Medical as background process instead:

```
docker run -p 4200:80 \
  --name mari-medical \
  --detach \
  --restart unless-stopped \
  -e ONPATIENT_REDIRECT_URI=https://localhost:4200/api/v1/onpatient/callback \
  -e ONPATIENT_CLIENT_ID=<ID_HERE> \
  -e ONPATIENT_CLIENT_SECRET=<SECRET_HERE> \
  -e DATABASE_NAME=mari_db \
  -e PUBLIC_URL=https://localhost:4200 \
  registry.mari.casa/mari-medical:latest
```

Note that neither of these will set up SSL for you, which is needed for some patient portal syncing/authentication flows. Look into using `mkcert` and/or a reverse proxy like `nginx` to set up localhost certificates.

### Setting Up with Docker Compose

Copy the following a docker compose file in a new directory. Note that the directory name becomes the prefix for the container. You'll need to replace items in the file that have the format `${VARIABLE_NAME}` with the actual value. Check out the [docker documentation](https://docs.docker.com/compose/environment-variables/#substitute-environment-variables-in-compose-files) for more information on how to do this securely.

To get the env variables needed for OnPatient functionality, [see our documentation here](./onpatient-setup).

```yaml title="docker-compose.yaml"
version: '3.9'

services:
  app:
    image: registry.mari.casa/mari-medical:latest
    ports:
      - '4200:80'
    environment:
      - ONPATIENT_REDIRECT_URI=${ONPATIENT_REDIRECT_URI}
      - ONPATIENT_CLIENT_ID=${ONPATIENT_CLIENT_ID}
      - ONPATIENT_CLIENT_SECRET=${ONPATIENT_CLIENT_SECRET}
      - DATABASE_NAME=${DATABASE_NAME}
      - PUBLIC_URL=${PUBLIC_URL}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up --detach`

to start Mari Medical as a background process.

Then open `http://localhost:4200` in a browser to see Mari Medical running!

Note that this will set up SSL for you, which is needed for some patient portal syncing/authentication flows. Look into using `mkcert` and/or a reverse proxy like `nginx` to set up localhost certificates.
