---
sidebar_position: 1
description: Get up and running with Docker
---

# Run with Docker or Docker Compose

These instructions will tell you how to get Mere Medical up and running on your machine with Docker or Docker Compose.

If you're looking to get Mere up and running on your local computer, we'd recommend following [these Docker Compose setup instructions](#setting-up-with-docker-compose--local-ssl-with-mkcert--nginx) as it will take you through step by step and help you set up local SSL.

If you want to run Mere on an external server and already have a reverse proxy with SSL set up, you can follow these [Docker](#setting-up-with-docker) instructions or [these Docker Compose instructions](#setting-up-with-docker-compose).

If you'd rather deploy to a cloud instance instead of your own computer, check out our [one click Digital Ocean deploy](./deploy-to-do.md).

## What you'll need

- [Docker](https://docs.docker.com/get-docker/)
- [mkcert](https://github.com/FiloSottile/mkcert#installation) (if you want to run Mere Medical locally with SSL)

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
      - EPIC_CLIENT_ID=${EPIC_CLIENT_ID}
      - EPIC_CLIENT_ID_DSTU2=${EPIC_CLIENT_ID_DSTU2}
      - EPIC_CLIENT_ID_R4=${EPIC_CLIENT_ID_R4}
      - EPIC_SANDBOX_CLIENT_ID=${EPIC_SANDBOX_CLIENT_ID}
      - EPIC_SANDBOX_CLIENT_ID_DSTU2=${EPIC_SANDBOX_CLIENT_ID_DSTU2}
      - EPIC_SANDBOX_CLIENT_ID_R4=${EPIC_SANDBOX_CLIENT_ID_R4}
      - CERNER_CLIENT_ID=${CERNER_CLIENT_ID}
      - VERADIGM_CLIENT_ID=${VERADIGM_CLIENT_ID}
      - VA_CLIENT_ID=${VA_CLIENT_ID}
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

Create an `.env' file with the following format:

```
ONPATIENT_CLIENT_ID=
ONPATIENT_CLIENT_SECRET=
EPIC_CLIENT_ID=
EPIC_CLIENT_ID_DSTU2=
EPIC_CLIENT_ID_R4=
EPIC_SANDBOX_CLIENT_ID=
EPIC_SANDBOX_CLIENT_ID_DSTU2=
EPIC_SANDBOX_CLIENT_ID_R4=
CERNER_CLIENT_ID=
VERADIGM_CLIENT_ID=
VA_CLIENT_ID=
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker compose --env-file .env up docker-compose up`

to start Mere Medical.

Then open [https://meremedical.local](https://meremedical.local) in a browser to see Mere Medical running!

### Setting Up with Docker

Run the following in your command prompt:

```
docker run -p 4200:80 -i -t \
  --name mere-medical \
  -e ONPATIENT_CLIENT_ID=<ID_HERE> \
  -e ONPATIENT_CLIENT_SECRET=<SECRET_HERE> \
  -e EPIC_CLIENT_ID=<ID_HERE> \
  -e EPIC_CLIENT_ID_DSTU2=<ID_HERE> \
  -e EPIC_CLIENT_ID_R4=<ID_HERE> \
  -e EPIC_SANDBOX_CLIENT_ID=<ID_HERE> \
  -e EPIC_SANDBOX_CLIENT_ID_DSTU2=<ID_HERE> \
  -e EPIC_SANDBOX_CLIENT_ID_R4=<ID_HERE> \
  -e CERNER_CLIENT_ID=<ID_HERE> \
  -e VERADIGM_CLIENT_ID=<ID_HERE> \
  -e VA_CLIENT_ID=<ID_HERE> \
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
  -e EPIC_CLIENT_ID=<ID_HERE> \
  -e EPIC_CLIENT_ID_DSTU2=<ID_HERE> \
  -e EPIC_CLIENT_ID_R4=<ID_HERE> \
  -e EPIC_SANDBOX_CLIENT_ID=<ID_HERE> \
  -e EPIC_SANDBOX_CLIENT_ID_DSTU2=<ID_HERE> \
  -e EPIC_SANDBOX_CLIENT_ID_R4=<ID_HERE> \
  -e CERNER_CLIENT_ID=<ID_HERE> \
  -e VERADIGM_CLIENT_ID=<ID_HERE> \
  -e VA_CLIENT_ID=<ID_HERE> \
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
      - EPIC_CLIENT_ID=${EPIC_CLIENT_ID}
      - EPIC_CLIENT_ID_DSTU2=${EPIC_CLIENT_ID_DSTU2}
      - EPIC_CLIENT_ID_R4=${EPIC_CLIENT_ID_R4}
      - EPIC_SANDBOX_CLIENT_ID=${EPIC_SANDBOX_CLIENT_ID}
      - EPIC_SANDBOX_CLIENT_ID_DSTU2=${EPIC_SANDBOX_CLIENT_ID_DSTU2}
      - EPIC_SANDBOX_CLIENT_ID_R4=${EPIC_SANDBOX_CLIENT_ID_R4}
      - CERNER_CLIENT_ID=${CERNER_CLIENT_ID}
      - VERADIGM_CLIENT_ID=${VERADIGM_CLIENT_ID}
      - VA_CLIENT_ID=${VA_CLIENT_ID}
      - PUBLIC_URL=${PUBLIC_URL}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up --detach`

to start Mere Medical as a background process.

Then open [http://localhost:4200](http://localhost:4200) in a browser to see Mere Medical running!

Note that this will not set up SSL for you, which is needed for some patient portal syncing/authentication flows. If you are running this on a server with reverse proxy already set up, it is recommended to have your reverse proxy handle SSL and forward requests to Mere Medical. If you are running this on your local machine and need local SSL set up, [follow the instructions here](/docs/getting-started/docker#setting-up-with-docker-compose--local-ssl-with-mkcert--nginx).

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PUBLIC_URL` | Yes | Full URL where Mere Medical is accessible. **Must include protocol** (`https://` or `http://`). | `https://app.meremedical.co` |
| `ONPATIENT_CLIENT_ID` | No | Client ID for OnPatient/DrChrono | See [OnPatient setup](./onpatient-setup) |
| `ONPATIENT_CLIENT_SECRET` | No | Client secret for OnPatient/DrChrono | See [OnPatient setup](./onpatient-setup) |
| `EPIC_CLIENT_ID_R4` | No | Client ID for Epic MyChart production (recommended) | See [Epic setup](./epic-setup) |
| `EPIC_SANDBOX_CLIENT_ID_R4` | No | Client ID for Epic MyChart sandbox (recommended) | See [Epic setup](./epic-setup) |
| `EPIC_CLIENT_ID` | No | Client ID for Epic MyChart production (legacy DSTU2, for backwards compatibility) | See [Epic setup](./epic-setup) |
| `EPIC_CLIENT_ID_DSTU2` | No | Client ID for Epic MyChart production (legacy DSTU2) | See [Epic setup](./epic-setup) |
| `EPIC_SANDBOX_CLIENT_ID` | No | Client ID for Epic MyChart sandbox (legacy DSTU2, for backwards compatibility) | See [Epic setup](./epic-setup) |
| `EPIC_SANDBOX_CLIENT_ID_DSTU2` | No | Client ID for Epic MyChart sandbox (legacy DSTU2) | See [Epic setup](./epic-setup) |
| `CERNER_CLIENT_ID` | No | Client ID for Cerner Health (supports both R4 and DSTU2) | See [Cerner setup](./cerner-setup) |
| `VERADIGM_CLIENT_ID` | No | Client ID for Veradigm | |
| `VA_CLIENT_ID` | No | Client ID for VA (Veterans Affairs). **Note: Only works with VA sandbox, not production access at this time.** | |

## Troubleshooting

### "Unable to search for healthcare systems"

This error means `PUBLIC_URL` is not configured correctly. Check browser DevTools Network tab - if you see `/$PUBLIC_URL/api/...` in request URLs, the variable isn't being injected.

**Common fixes:**
- Ensure `PUBLIC_URL` includes protocol: `https://yourdomain.com` (not `yourdomain.com`)
- Check for typos in variable name (`PUBLIC_URL` not `PUBLIC_ULR`)
- After changing `.env`, recreate the container: `docker compose down && docker compose rm && docker compose up`
- Clear browser cache with `Ctrl+F5` or try a different browser (Brave has known caching issues)

**Note:** Environment variables are injected only when the container first starts. Restarting won't pick up changes - you must remove and recreate the container.
