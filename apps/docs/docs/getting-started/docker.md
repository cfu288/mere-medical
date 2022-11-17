---
sidebar_position: 1
description: Get up and running with Docker
---

# Run with Docker

These instructions will tell you how to get Mari Medical up and running with Docker or Docker Compose.

As Mari Medical is still being developed, so is this documentation. Complete documentation is coming soon!

## What you'll need

- [Docker](https://docs.docker.com/get-docker/)
- [mkcert](https://github.com/FiloSottile/mkcert#installation) (if you want to run Mari Medical locally with SSL)

### Setting Up with Docker

Run the following in your command prompt:

```
docker run -p 4200:80 -i -t \
  --name mari-medical \
  -e ONPATIENT_CLIENT_ID=<ID_HERE> \
  -e ONPATIENT_CLIENT_SECRET=<SECRET_HERE> \
  -e PUBLIC_URL=https://localhost:4200 \
  registry.mari.casa/mari-medical:latest
```

Then open http://localhost:4200 in a browser to see Mari Medical running!

If you'd like to run Mari Medical as background process instead:

```
docker run -p 4200:80 \
  --name mari-medical \
  --detach \
  --restart unless-stopped \
  -e ONPATIENT_CLIENT_ID=<ID_HERE> \
  -e ONPATIENT_CLIENT_SECRET=<SECRET_HERE> \
  -e PUBLIC_URL=https://localhost:4200 \
  registry.mari.casa/mari-medical:latest
```

Note that neither of these will set up SSL for you, which is needed for some patient portal syncing/authentication flows. If you are running this on a server with reverse proxy already set up, it is recommended to have your reverse proxy handle SSL and forward requests to Mari Medical. If you are running this on your local machine and need local SSL set up, read the section below.

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
      - ONPATIENT_CLIENT_ID=${ONPATIENT_CLIENT_ID}
      - ONPATIENT_CLIENT_SECRET=${ONPATIENT_CLIENT_SECRET}
      - PUBLIC_URL=${PUBLIC_URL}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up --detach`

to start Mari Medical as a background process.

Then open http://localhost:4200 in a browser to see Mari Medical running!

Note that this will not set up SSL for you, which is needed for some patient portal syncing/authentication flows. If you are running this on a server with reverse proxy already set up, it is recommended to have your reverse proxy handle SSL and forward requests to Mari Medical. If you are running this on your local machine and need local SSL set up, read the section below.

### Setting Up with Docker Compose & Local SSL with mkcert + NGINX

Copy the following a docker compose file in a new directory.

```yaml title="mari-medical/docker-compose.yaml"
version: '3.9'

services:
  nginx:
    image: nginx:latest
    ports:
      - 443:443
    volumes:
      - ./nginx/certs/:/etc/nginx/ssl
      - ./nginx/conf/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
  app:
    image: registry.mari.casa/mari-medical:latest
    container_name: mari-medical-app
    environment:
      - ONPATIENT_CLIENT_ID=${ONPATIENT_CLIENT_ID}
      - ONPATIENT_CLIENT_SECRET=${ONPATIENT_CLIENT_SECRET}
      - PUBLIC_URL=https://marimedical.local
```

Note that the directory name becomes the prefix for the container, we suggest naming the folder `mari-medical`. Create a nginx subdirectory, which contains folders `conf` and `certs`. Your folder directory should look something like this:

```
mari-medical
  docker-compose.yaml
  nginx/
    conf/
    certs/
```

```bash
mkcert -key-file nginx/certs/ssl.key -cert-file nginx/certs/ssl.crt marimedical.local
```

Add the following entry to your `/etc/hosts` file:

```bash title="/etc/hosts"
##
# Host Database
#
# localhost is used to configure the loopback interface
# when the system is booting.  Do not change this entry.
##
127.0.0.1	localhost
## Add this new line below
127.0.0.1	marimedical.local
```

Create a nginx.conf in the conf folder with the following contents:

```conf title="mari-medical/nginx/conf/nginx.conf"
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;

  ssl_certificate /etc/nginx/ssl/ssl.crt;
  ssl_certificate_key /etc/nginx/ssl/ssl.key;
  ssl_protocols TLSv1.2;

  location / {
    proxy_pass http://mari-medical-app/;
  }
}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up`

to start Mari Medical.

Then open https://marimedical.local in a browser to see Mari Medical running!