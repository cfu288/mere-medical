---
sidebar_position: 1
description: Get up and running with Docker
---

# Run with Docker or Docker Compose

These instructions will tell you how to get Mere Medical up and running on your machine with Docker or Docker Compose.

:::warning Mere must be served over HTTPS (or accessed via localhost)

Mere relies on browser Web Crypto APIs (such as `crypto.randomUUID`), which browsers only enable on **secure origins** — `https://` URLs or `localhost`. If you access Mere over plain HTTP from any other address (e.g. `http://192.168.1.50:4200` from another device on your network), the app cannot start and you will see a **white screen**.

Either open Mere at `http://localhost:<port>` on the machine running it, or put it behind a reverse proxy that terminates SSL — the [local SSL setup below](#setting-up-with-docker-compose--local-ssl-with-caddy) walks you through this.

:::

If you're looking to get Mere up and running on your local computer, we'd recommend following [these Docker Compose setup instructions](#setting-up-with-docker-compose--local-ssl-with-caddy) as it will take you through step by step and help you set up local SSL.

If you want to run Mere on an external server and already have a reverse proxy with SSL set up, you can follow these [Docker](#setting-up-with-docker) instructions or [these Docker Compose instructions](#setting-up-with-docker-compose).

If you'd rather deploy to a cloud instance instead of your own computer, check out our [one click Digital Ocean deploy](./deploy-to-do.md).

## What you'll need

- [Docker](https://docs.docker.com/get-docker/)

### Setting Up with Docker Compose & Local SSL with Caddy

You can grab the required files for the following steps [here](https://github.com/cfu288/mere-medical/tree/main/examples/mere-medical-docker-compose-caddy-ssl).

If not, then you can create a new directory and copy the following a docker compose file into it.

```yaml title="mere-medical/docker-compose.yaml"
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - '443:443'
      - '443:443/udp'
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
    networks:
      - proxy
    depends_on:
      app:
        condition: service_healthy
  app:
    image: cfu288/mere-medical:latest
    container_name: mere-medical-app
    restart: unless-stopped
    init: true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    networks:
      - proxy
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
      - HEALOW_CLIENT_ID=${HEALOW_CLIENT_ID}
      - HEALOW_CLIENT_SECRET=${HEALOW_CLIENT_SECRET}
      - PUBLIC_URL=https://meremedical.local

networks:
  proxy: {}

volumes:
  caddy-data:
  caddy-config:
```

The app container is only reachable through Caddy on the shared `proxy` network — no ports are published on it directly.

Note that the directory name becomes the prefix for the container, we suggest naming the folder `mere-medical`. Create a `caddy` subdirectory next to the compose file:

```
mere-medical
  docker-compose.yaml
  caddy/
    Caddyfile
```

Create a Caddyfile in the caddy folder with the following contents:

```text title="mere-medical/caddy/Caddyfile"
meremedical.local {
	tls internal
	reverse_proxy mere-medical-app:8080
}
```

`tls internal` makes Caddy issue a certificate for `meremedical.local` from its own local certificate authority — no separate cert generation step is needed. If you have a real public domain instead, replace `meremedical.local` with it and delete the `tls internal` line; Caddy will fetch and renew Let's Encrypt certificates automatically.

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
HEALOW_CLIENT_ID=
HEALOW_CLIENT_SECRET=
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker compose --env-file .env up --detach`

to start Mere Medical.

Finally, trust Caddy's local certificate authority so your browser accepts the certificate. Export the root certificate:

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt caddy-local-ca.crt
```

Then trust it — on macOS:

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain caddy-local-ca.crt
```

or on Linux:

```bash
sudo cp caddy-local-ca.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates
```

(Firefox keeps its own certificate store — import `caddy-local-ca.crt` under Settings → Certificates if needed. This trust step is only for the local `tls internal` setup; with a real domain and Let's Encrypt there is nothing to trust manually.)

Then open [https://meremedical.local](https://meremedical.local) in a browser to see Mere Medical running!

### Setting Up with Docker

Run the following in your command prompt:

```
docker run -p 4200:8080 -i -t \
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
  -e HEALOW_CLIENT_ID=<ID_HERE> \
  -e HEALOW_CLIENT_SECRET=<SECRET_HERE> \
  -e PUBLIC_URL=https://localhost:4200 \
  cfu288/mere-medical:latest
```

Then open [http://localhost:4200](http://localhost:4200) in a browser to see Mere Medical running!

If you'd like to run Mere Medical as background process instead:

```
docker run -p 4200:8080 \
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
  -e HEALOW_CLIENT_ID=<ID_HERE> \
  -e HEALOW_CLIENT_SECRET=<SECRET_HERE> \
  -e PUBLIC_URL=https://localhost:4200 \
  cfu288/mere-medical:latest
```

Note that neither of these will set up SSL for you, which is needed for some patient portal syncing/authentication flows. If you are running this on a server with reverse proxy already set up, it is recommended to have your reverse proxy handle SSL and forward requests to Mere Medical. If you are running this on your local machine and need local SSL set up, read the section below.

### Setting Up with Docker Compose

Copy the following a docker compose file in a new directory. Note that the directory name becomes the prefix for the container. You'll need to replace items in the file that have the format `${VARIABLE_NAME}` with the actual value. Check out the [docker documentation](https://docs.docker.com/compose/environment-variables/#substitute-environment-variables-in-compose-files) for more information on how to do this securely.

To get the env variables needed for OnPatient functionality, [see our documentation here](./onpatient-setup).

```yaml title="docker-compose.yaml"
services:
  app:
    image: cfu288/mere-medical:latest
    ports:
      - '4200:8080'
    restart: unless-stopped
    init: true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
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
      - HEALOW_CLIENT_ID=${HEALOW_CLIENT_ID}
      - HEALOW_CLIENT_SECRET=${HEALOW_CLIENT_SECRET}
      - PUBLIC_URL=${PUBLIC_URL}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up --detach`

to start Mere Medical as a background process.

Then open [http://localhost:4200](http://localhost:4200) in a browser to see Mere Medical running!

Note that this will not set up SSL for you, which is needed for some patient portal syncing/authentication flows. If you are running this on a server with reverse proxy already set up, it is recommended to have your reverse proxy handle SSL and forward requests to Mere Medical. If you are running this on your local machine and need local SSL set up, [follow the instructions here](/docs/getting-started/docker#setting-up-with-docker-compose--local-ssl-with-caddy).

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
| `HEALOW_CLIENT_ID` | No | Client ID for Healow (eClinicalWorks) | See [Healow setup](./healow-setup) |
| `HEALOW_CLIENT_SECRET` | No | Client secret for Healow confidential client (enables refresh tokens) | See [Healow setup](./healow-setup) |

## Troubleshooting

### White screen when opening Mere from another device (or a LAN IP)

If Mere works at `http://localhost:4200` but shows a blank white page when accessed via your machine's network address (e.g. `http://192.168.1.50:4200`), you are hitting the secure-origin requirement described at the top of this page. The browser console will show an error like:

```
Uncaught TypeError: window.crypto.randomUUID is not a function
```

Browsers only expose the Web Crypto APIs Mere needs on `https://` origins or `localhost`, so plain-HTTP access from any other address cannot work — this is a browser security restriction, not a configuration bug. Serve Mere through a reverse proxy with SSL ([local SSL setup instructions](#setting-up-with-docker-compose--local-ssl-with-caddy)), or access it from the host machine via `localhost`.

### "Unable to search for healthcare systems"

This error means `PUBLIC_URL` is not configured correctly. Check browser DevTools Network tab - if you see `/$PUBLIC_URL/api/...` in request URLs, the variable isn't being injected.

**Common fixes:**
- Ensure `PUBLIC_URL` includes protocol: `https://yourdomain.com` (not `yourdomain.com`)
- Check for typos in variable name (`PUBLIC_URL` not `PUBLIC_ULR`)
- After changing `.env`, recreate the container: `docker compose down && docker compose rm && docker compose up`
- Clear browser cache with `Ctrl+F5` or try a different browser (Brave has known caching issues)

**Note:** Environment variables are injected only when the container first starts. Restarting won't pick up changes - you must remove and recreate the container.
