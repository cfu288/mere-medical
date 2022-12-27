---
sidebar_position: 1
description: Get up and running with Docker
---

# Run with Docker

These instructions will tell you how to get Mere Medical up and running on your machine with Docker or Docker Compose.

## What you'll need

- [Docker](https://docs.docker.com/get-docker/)
- [mkcert](https://github.com/FiloSottile/mkcert#installation) (if you want to run Mere Medical locally with SSL)

### Setting Up with Docker

Run the following in your command prompt:

```
docker run -p 4200:80 -i -t \
  --name mere-medical \
  -e ONPATIENT_CLIENT_ID=<ID_HERE> \
  -e ONPATIENT_CLIENT_SECRET=<SECRET_HERE> \
  -e PUBLIC_URL=https://localhost:4200 \
  cfu288/mere-medical:latest
```

Then open [http://localhost:4200](http://localhost:4200) in a browser to see Mere Medical running!

If you'd like to run Mere Medical as background process instead:

```
docker run -p 4200:80 \
  --name mere-medical \
  --detach \
  --restart unless-stopped \
  -e ONPATIENT_CLIENT_ID=<ID_HERE> \
  -e ONPATIENT_CLIENT_SECRET=<SECRET_HERE> \
  -e PUBLIC_URL=https://localhost:4200 \
  cfu288/mere-medical:latest
```

Note that neither of these will set up SSL for you, which is needed for some patient portal syncing/authentication flows. If you are running this on a server with reverse proxy already set up, it is recommended to have your reverse proxy handle SSL and forward requests to Mere Medical. If you are running this on your local machine and need local SSL set up, read the section below.

### Setting Up with Docker Compose

Copy the following a docker compose file in a new directory. Note that the directory name becomes the prefix for the container. You'll need to replace items in the file that have the format `${VARIABLE_NAME}` with the actual value. Check out the [docker documentation](https://docs.docker.com/compose/environment-variables/#substitute-environment-variables-in-compose-files) for more information on how to do this securely.

To get the env variables needed for OnPatient functionality, [see our documentation here](./onpatient-setup).

```yaml title="docker-compose.yaml"
version: '3.9'

services:
  app:
    image: cfu288/mere-medical:latest
    ports:
      - '4200:80'
    environment:
      - ONPATIENT_CLIENT_ID=${ONPATIENT_CLIENT_ID}
      - ONPATIENT_CLIENT_SECRET=${ONPATIENT_CLIENT_SECRET}
      - PUBLIC_URL=${PUBLIC_URL}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up --detach`

to start Mere Medical as a background process.

Then open [http://localhost:4200](http://localhost:4200) in a browser to see Mere Medical running!

Note that this will not set up SSL for you, which is needed for some patient portal syncing/authentication flows. If you are running this on a server with reverse proxy already set up, it is recommended to have your reverse proxy handle SSL and forward requests to Mere Medical. If you are running this on your local machine and need local SSL set up, read the section below.

### Setting Up with Docker Compose & Local SSL with mkcert + NGINX

You can grab the required files for the following steps [here](https://github.com/cfu288/mere-medical/tree/main/examples/mere-medical-docker-compose-nginx-ssl).

If not, then you can create a new directory and copy the following a docker compose file into it.

```yaml title="mere-medical/docker-compose.yaml"
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
    image: cfu288/mere-medical:latest
    container_name: mere-medical-app
    environment:
      - ONPATIENT_CLIENT_ID=${ONPATIENT_CLIENT_ID}
      - ONPATIENT_CLIENT_SECRET=${ONPATIENT_CLIENT_SECRET}
      - PUBLIC_URL=https://meremedical.local
```

Note that the directory name becomes the prefix for the container, we suggest naming the folder `mere-medical`. Create a nginx subdirectory, which contains folders `conf` and `certs`. Your folder directory should look something like this:

```
mere-medical
  docker-compose.yaml
  nginx/
    conf/
    certs/
```

From the root folder, run the following command to set up local certs:

```bash
mkcert -key-file nginx/certs/ssl.key -cert-file nginx/certs/ssl.crt meremedical.local
```

Run `mkcert -install` if prompted to.

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
127.0.0.1	meremedical.local
```

Create a nginx.conf in the conf folder with the following contents:

```conf title="mere-medical/nginx/conf/nginx.conf"
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;

  ssl_certificate /etc/nginx/ssl/ssl.crt;
  ssl_certificate_key /etc/nginx/ssl/ssl.key;
  ssl_protocols TLSv1.2;

  location / {
    proxy_pass http://mere-medical-app/;
  }
}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up`

to start Mere Medical.

Then open [https://meremedical.local](https://meremedical.local) in a browser to see Mere Medical running!
