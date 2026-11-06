---
sidebar_position: 1
description: Get up and running with Docker
---

# Run with Docker or Docker Compose

These instructions will tell you how to get Mere Medical up and running on your machine with Docker or Docker Compose.

:::warning Mere must be served over HTTPS (or accessed via localhost)

Mere relies on browser Web Crypto APIs (such as `crypto.randomUUID`), which browsers only enable on **secure origins**: `https://` URLs or `localhost`. If you access Mere over plain HTTP from any other address (e.g. `http://192.168.1.50:4200` from another device on your network), the app cannot start and you will see a **white screen**.

Either open Mere at `http://localhost:<port>` on the machine running it, or put it behind a [reverse proxy that terminates SSL](#running-behind-a-reverse-proxy).

:::

If you just want Mere running on your own computer, follow the [Docker](#setting-up-with-docker) or [Docker Compose](#setting-up-with-docker-compose) instructions and open it at `http://localhost:4200`. That is a secure origin, so everything works with no certificate setup.

To connect Mere to patient portals such as OnPatient, Epic, or Healow, you will need a real domain name and HTTPS. Most portals only accept `https://` redirect URLs, and some reject `localhost` entirely. See [running behind a reverse proxy](#running-behind-a-reverse-proxy).

If you'd rather deploy to a cloud instance instead of your own computer, check out our [one click Digital Ocean deploy](./deploy-to-do.md).

## What you'll need

- [Docker](https://docs.docker.com/get-docker/)

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
  -e ATHENA_CLIENT_ID=<ID_HERE> \
  -e ATHENA_SANDBOX_CLIENT_ID=<ID_HERE> \
  -e NEXTGEN_CLIENT_ID=<ID_HERE> \
  -e NEXTGEN_CLIENT_SECRET=<SECRET_HERE> \
  -e APP_KEY=<KEY_HERE> \
  -e PUBLIC_URL=http://localhost:4200 \
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
  -e ATHENA_CLIENT_ID=<ID_HERE> \
  -e ATHENA_SANDBOX_CLIENT_ID=<ID_HERE> \
  -e NEXTGEN_CLIENT_ID=<ID_HERE> \
  -e NEXTGEN_CLIENT_SECRET=<SECRET_HERE> \
  -e APP_KEY=<KEY_HERE> \
  -e PUBLIC_URL=http://localhost:4200 \
  cfu288/mere-medical:latest
```

Neither of these sets up SSL. That is fine for use on the machine running Mere, since `localhost` is a secure origin. To reach Mere from another device, or to connect it to a patient portal, put it behind a [reverse proxy that terminates SSL](#running-behind-a-reverse-proxy).

### Setting Up with Docker Compose

Copy the following docker compose file into a new directory. Note that the directory name becomes the prefix for the container. You'll need to replace items in the file that have the format `${VARIABLE_NAME}` with the actual value. Check out the [docker documentation](https://docs.docker.com/compose/environment-variables/#substitute-environment-variables-in-compose-files) for more information on how to do this securely.

To get the env variables needed for OnPatient functionality, [see our documentation here](./onpatient-setup).

```yaml title="docker-compose.yaml"
services:
  app:
    image: cfu288/mere-medical:latest
    ports:
      - '4200:8080'
    restart: unless-stopped
    init: true
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
      - ATHENA_CLIENT_ID=${ATHENA_CLIENT_ID}
      - ATHENA_SANDBOX_CLIENT_ID=${ATHENA_SANDBOX_CLIENT_ID}
      - NEXTGEN_CLIENT_ID=${NEXTGEN_CLIENT_ID}
      - NEXTGEN_CLIENT_SECRET=${NEXTGEN_CLIENT_SECRET}
      - APP_KEY=${APP_KEY}
      - ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=${ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS}
      - PUBLIC_URL=${PUBLIC_URL}
```

`cd` into the directory of the `docker-compose.yaml` , and then run

`docker-compose up --detach`

to start Mere Medical as a background process.

Then open [http://localhost:4200](http://localhost:4200) in a browser to see Mere Medical running!

This does not set up SSL. That is fine for use on the machine running Mere, since `localhost` is a secure origin. To reach Mere from another device, or to connect it to a patient portal, put it behind a [reverse proxy that terminates SSL](#running-behind-a-reverse-proxy).

### Running Behind a Reverse Proxy

You need this if you want to open Mere from another device, or connect it to a patient portal. Most portals only accept `https://` redirect URLs, and the VA and Healow reject `localhost` addresses outright, so a real domain name pointing at your server is the practical requirement.

If you already run a reverse proxy, point it at the app container's port `8080` and set `PUBLIC_URL` to the URL your users visit. If you don't, the example below uses [Caddy](https://caddyserver.com/), which obtains and renews Let's Encrypt certificates automatically. Ready-made files are [here](https://github.com/cfu288/mere-medical/tree/main/examples/mere-medical-docker-compose-caddy-ssl).

Replace `mere.example.com` with your own domain in both files below, and make sure it resolves to this server and that ports 80 and 443 are reachable from the internet. Let's Encrypt needs both to issue the certificate.

```text title="mere-medical/caddy/Caddyfile"
mere.example.com {
	reverse_proxy app:8080
}
```

```yaml title="mere-medical/docker-compose.yaml"
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - '80:80'
      - '443:443'
      - '443:443/udp'
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    networks:
      - proxy
    depends_on:
      app:
        condition: service_healthy
  app:
    image: cfu288/mere-medical:latest
    restart: unless-stopped
    init: true
    security_opt:
      - no-new-privileges:true
    networks:
      - proxy
    environment:
      - ONPATIENT_CLIENT_ID=${ONPATIENT_CLIENT_ID}
      - ONPATIENT_CLIENT_SECRET=${ONPATIENT_CLIENT_SECRET}
      - EPIC_CLIENT_ID_R4=${EPIC_CLIENT_ID_R4}
      - EPIC_SANDBOX_CLIENT_ID_R4=${EPIC_SANDBOX_CLIENT_ID_R4}
      - EPIC_CLIENT_ID=${EPIC_CLIENT_ID}
      - EPIC_SANDBOX_CLIENT_ID=${EPIC_SANDBOX_CLIENT_ID}
      - CERNER_CLIENT_ID=${CERNER_CLIENT_ID}
      - VERADIGM_CLIENT_ID=${VERADIGM_CLIENT_ID}
      - VA_CLIENT_ID=${VA_CLIENT_ID}
      - HEALOW_CLIENT_ID=${HEALOW_CLIENT_ID}
      - HEALOW_CLIENT_SECRET=${HEALOW_CLIENT_SECRET}
      - ATHENA_CLIENT_ID=${ATHENA_CLIENT_ID}
      - ATHENA_SANDBOX_CLIENT_ID=${ATHENA_SANDBOX_CLIENT_ID}
      - NEXTGEN_CLIENT_ID=${NEXTGEN_CLIENT_ID}
      - NEXTGEN_CLIENT_SECRET=${NEXTGEN_CLIENT_SECRET}
      - APP_KEY=${APP_KEY}
      - ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=${ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS}
      - PUBLIC_URL=https://mere.example.com

networks:
  proxy: {}

volumes:
  caddy-data:
  caddy-config:
```

The app container is only reachable through Caddy on the shared `proxy` network, because no ports are published on it directly. The directory name becomes the container name prefix, so we suggest naming the folder `mere-medical`:

```
mere-medical
  docker-compose.yaml
  caddy/
    Caddyfile
```

Start it with `docker compose --env-file .env up --detach`, then open your domain in a browser. Register `https://mere.example.com` as the redirect URL base when you set up each patient portal.

## Environment Variables Reference

| Variable                            | Required                   | Description                                                                                                                            | Example                                  |
| ----------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `PUBLIC_URL`                        | Yes                        | Full URL where Mere Medical is accessible. **Must include protocol** (`https://` or `http://`).                                        | `https://app.meremedical.co`             |
| `ONPATIENT_CLIENT_ID`               | No                         | Client ID for OnPatient/DrChrono                                                                                                       | See [OnPatient setup](./onpatient-setup) |
| `ONPATIENT_CLIENT_SECRET`           | No                         | Client secret for OnPatient/DrChrono                                                                                                   | See [OnPatient setup](./onpatient-setup) |
| `EPIC_CLIENT_ID_R4`                 | No                         | Client ID for Epic MyChart production (recommended)                                                                                    | See [Epic setup](./epic-setup)           |
| `EPIC_SANDBOX_CLIENT_ID_R4`         | No                         | Client ID for Epic MyChart sandbox (recommended)                                                                                       | See [Epic setup](./epic-setup)           |
| `EPIC_CLIENT_ID`                    | No                         | Client ID for Epic MyChart production (legacy DSTU2, for backwards compatibility)                                                      | See [Epic setup](./epic-setup)           |
| `EPIC_CLIENT_ID_DSTU2`              | No                         | Client ID for Epic MyChart production (legacy DSTU2)                                                                                   | See [Epic setup](./epic-setup)           |
| `EPIC_SANDBOX_CLIENT_ID`            | No                         | Client ID for Epic MyChart sandbox (legacy DSTU2, for backwards compatibility)                                                         | See [Epic setup](./epic-setup)           |
| `EPIC_SANDBOX_CLIENT_ID_DSTU2`      | No                         | Client ID for Epic MyChart sandbox (legacy DSTU2)                                                                                      | See [Epic setup](./epic-setup)           |
| `CERNER_CLIENT_ID`                  | No                         | Client ID for Cerner Health (supports both R4 and DSTU2)                                                                               | See [Cerner setup](./cerner-setup)       |
| `VERADIGM_CLIENT_ID`                | No                         | Client ID for Veradigm                                                                                                                 |                                          |
| `VA_CLIENT_ID`                      | No                         | Client ID for VA (Veterans Affairs). **Only works with the VA sandbox, not production access at this time.**                           |                                          |
| `HEALOW_CLIENT_ID`                  | No                         | Client ID for Healow (eClinicalWorks)                                                                                                  | See [Healow setup](./healow-setup)       |
| `HEALOW_CLIENT_SECRET`              | No                         | Client secret for Healow confidential client (enables refresh tokens)                                                                  | See [Healow setup](./healow-setup)       |
| `ATHENA_CLIENT_ID`                  | No                         | Client ID for Athena Health production                                                                                                 | See [Athena setup](./athena-setup)       |
| `ATHENA_SANDBOX_CLIENT_ID`          | No                         | Client ID for Athena Health sandbox (Preview)                                                                                          | See [Athena setup](./athena-setup)       |
| `NEXTGEN_CLIENT_ID`                 | No                         | Client ID for NextGen Enterprise                                                                                                       | See [NextGen setup](./nextgen-setup)     |
| `NEXTGEN_CLIENT_SECRET`             | No                         | Client secret for NextGen Enterprise. Required alongside the client ID. The server keeps it.                                           | See [NextGen setup](./nextgen-setup)     |
| `APP_KEY`                           | If you set a client secret | Private secret that signs the registration token in invite links. Exactly the 32 characters `generate-app-key` prints. Never share it. | See [App key](#app-key)                  |
| `APP_CONTACT`                       | No                         | Who users should ask for an invite link, such as an email address. Shown in the app when a registration token is missing or refused.   | `admin@example.com`                      |
| `ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS` | No                         | Set to `true` to run those routes without a registration token.                                                                        | See [App key](#app-key)                  |

## App Key

Healow, NextGen, and OnPatient give your registered app a client secret. Mere keeps that secret on the server, and the server exchanges login codes for tokens on behalf of the browser. Without a check on the caller, another app could send its own users through the vendor consent screen with your client ID and redirect URL. It could then exchange the codes through your instance. This does not put your medical records at risk. It could let third parties abuse your app registration, and the EHR vendor could then close your registration. Invite links close that path. Each link carries a registration token that the server signs with your `APP_KEY`, and only browsers with that token can use those routes. The link never contains the key itself.

> **Breaking change 11/2/2026.** If you run Healow, NextGen, or OnPatient with its client secret, you must also set `APP_KEY`. Alternatively you can set `ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=true` if you do not want these protections. Otherwise the container does not start, and the web app is not served either. If you do not have these integrations enabled, you need no change. See [Upgrade a deployment from before 11/2/2026](#upgrade-a-deployment-from-before-1122026).

### Variables

| Variable                            | When                                                                                                                         | What it does                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_KEY`                           | Required when you set a Healow, NextGen, or OnPatient client secret, unless you set `ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=true` | Private secret that the server uses to sign the registration token in invite links. Generate it with `generate-app-key`. It must be exactly the 32 characters `generate-app-key` prints. Those are letters, digits, `-`, and `_`. The server trims surrounding spaces. A value that starts with `$` counts as unset. Any other value stops the container at start. Never share the key itself. |
| `APP_CONTACT`                       | Optional                                                                                                                     | Who users should ask for an invite link, such as an email address. The app shows it when a registration token is missing or refused.                                                                                                                                                                                                                                                           |
| `ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS` | Optional                                                                                                                     | Set to `true` to run those routes without a registration token. If you set both `APP_KEY` and `ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=true`, the key applies and the server logs a warning.                                                                                                                                                                                                         |

### Set up the app key

1. Generate a key with `docker compose run --rm app generate-app-key`. It prints one line, such as `APP_KEY=Wo5afxExmyQKIiO1mTm0nghRWNtkwpCG`.
2. Copy that line into `.env`. If `.env` already has an empty `APP_KEY=` line, replace it.
3. Recreate the container with `docker compose up -d --force-recreate app`.
4. Print the invite link with `docker compose run --rm app generate-invite-link`.
5. Send the link to each person who uses Healow, NextGen, or OnPatient on your instance. Never send `APP_KEY` itself.

### Invite link

`generate-invite-link` prints the invite link for the `PUBLIC_URL` of the container. The link carries a registration token signed with the container's `APP_KEY`, not the key. Every run prints the same link. Without compose, generate a key with `docker run --rm cfu288/mere-medical generate-app-key` and print the link with `docker exec mere-medical generate-invite-link`. Opening the link from the end user's web app saves the registration token in that browser.

If `APP_KEY` is set, a browser without a registration token cannot start a Healow, NextGen, or OnPatient connection. The Healow, NextGen, and OnPatient tiles tell the user to open the invite link from their Mere administrator, and name the `APP_CONTACT` when it is set. Settings > Privacy and Security shows whether the browser has a registration token.

### Issue a new registration token

Issue a new registration token via invite link. Set a new `APP_KEY`, recreate the container, and send the new invite link from `generate-invite-link`. The server refuses a browser that still has the old registration token on its next Healow, NextGen, or OnPatient login or refresh. The message tells the user to ask for a new invite link. Opening the new link replaces the old registration token.

### Public instance

`ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=true` without `APP_KEY` runs the token routes with no registration token check. Any app that can reach your instance can then exchange codes through it with your client ID and secret. Use this only for an instance nobody else can reach. Examples are a port published on loopback only (`-p 127.0.0.1:4200:8080`), a VPN, or basic auth at your reverse proxy.

### Upgrade a deployment from before 11/2/2026

Since 11/2/2026, a container with a Healow, NextGen, or OnPatient client secret does not start until you also set `APP_KEY` or `ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=true`. The startup error in `docker compose logs app` says what to set. Deployments without these secrets need no change.

1. In your compose file, add `- APP_KEY=${APP_KEY}` to the `environment` list of the `app` service.
2. Follow [Set up the app key](#set-up-the-app-key).

## Troubleshooting

### White screen when opening Mere from another device (or a LAN IP)

If Mere works at `http://localhost:4200` but shows a blank white page when accessed via your machine's network address (e.g. `http://192.168.1.50:4200`), you are hitting the secure-origin requirement described at the top of this page. The browser console will show an error like:

```
Uncaught TypeError: window.crypto.randomUUID is not a function
```

Browsers only expose the Web Crypto APIs Mere needs on `https://` origins or `localhost`, so plain-HTTP access from any other address cannot work. This is a browser security restriction, not a configuration bug. Access Mere from the host machine via `localhost`, or serve it through a [reverse proxy with SSL](#running-behind-a-reverse-proxy).

### "Unable to search for healthcare systems"

This error means `PUBLIC_URL` is not configured correctly. Check browser DevTools Network tab - if you see `/$PUBLIC_URL/api/...` in request URLs, the variable isn't being injected.

**Common fixes:**

- Ensure `PUBLIC_URL` includes protocol: `https://yourdomain.com` (not `yourdomain.com`)
- Check for typos in variable name (`PUBLIC_URL` not `PUBLIC_ULR`)
- After changing `.env`, recreate the container: `docker compose down && docker compose rm && docker compose up`
- Clear browser cache with `Ctrl+F5` or try a different browser (Brave has known caching issues)

**Note:** Environment variables are injected only when the container first starts. Restarting won't pick up changes - you must remove and recreate the container.
