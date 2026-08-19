# Running Mere Medical Behind Caddy with SSL

This is an example folder showing how to run Mere Medical behind Caddy, which obtains and renews Let's Encrypt certificates automatically. See [the full instructions provided here](https://meremedical.co/docs/getting-started/docker#running-behind-a-reverse-proxy)

Replace `mere.example.com` with your own domain in `caddy/Caddyfile` and `docker-compose.yaml`. The domain must resolve to this server, and ports 80 and 443 must be reachable from the internet for Let's Encrypt to issue the certificate.

```
docker compose --env-file .env up
```
