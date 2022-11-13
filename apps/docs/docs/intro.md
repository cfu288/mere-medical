---
sidebar_position: 1
---

# What is Mari Medical?

How long would it take you to collect _all_ of your medical records from every doctor or hospital you've been to? For most people, it would take a long time. You'd need to log in to various patient portals, find paper copies of older records that still need to be digitized, and collect old immunization records. Maybe you also have some medical imaging stored on CDs or USB drives. It's surprisingly hard to get all your records digitalized and in one place without a lot of manual curation.

Many hospitals have online patient portals, which is a helpful first step in making your records easy to access. Still, different health systems have different portals - each with different logins. On the other hand, some private companies attempt to make this task easier by collecting and managing your medical records for you - but can you trust them?

Mari Medical tries to provide a solution to this complex problem. Mari Medical is a self-hosted web application that allows you to collect all your medical records in one place. It handles collecting and curating your records, so you don't have to.

Here are our goals:

- **Free**: Mari Medical will always be free to download and self-host. Everyone should have easy access to their medical records.
- **Built on open standards**: Conforming to open standards like HL7 FHIR will enable interoperability between multiple healthcare systems.
- **Open Source**: You shouldn't need to take us for our word. Our source is available so you can review each line of code that is going to be touching your medical records.
- **Self-Hostable**: You can run this software on your local computer or your own servers. No need to rely on third-party services.
- **Offline-First**: While some features need online connectivity, the web app will always function offline so you can access your records - even if you can't access the internet.
- **Multi-device syncing support**: Medical records are useless if they're stuck on your computer but you only have your phone on you.

Mari Medical is still in the early stages of its development. Lots of features are still rough around the edges. Using Mari Medical currently requires someone with a technical background to get it up and running - you should be familiar with docker. The hope is that by keeping this open source, others can run this software so others can use it without setup.

[Check out our live demo here](https://medical.mari.casa)

## Getting Started

As Mari Medical is still being developed, so is this documentation. Complete documentation is coming soon!

### What you'll need

- Docker

#### Setting Up

Copy the following a docker compose file in a new directory. Note that the directory name becomes the prefix for the container. You'll need to replace items in the file that have the format `${VARIABLE_NAME}` with the actual value. Check out the [docker documentation](https://docs.docker.com/compose/environment-variables/#substitute-environment-variables-in-compose-files) for more information on how to do this securely.

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

##### Getting OnPatient Authentication Set Up

Due to limitations in OnPatient's API's, in order for Mari Medical to access your medical records on your behalf, you'll need to get a client secret and client id value from the OnPatient patient portal. You can do this by visiting your [OnPatient account settings page](https://www.onpatient.com/account/settings/) and clicking `Edit` in the box that says `FHIR API Application Management`. Click `Add New App` and enter a name for the app (any name is fine, you can write `Mari` for clarity).

You'll now need to set the redirect URI to redirect to the API part of Mari Medical. By default this is served at `https://localhost:4201/api/v1/onpatient/callback`. Note that the url schema must be HTTPS and not HTTP or OnPatient will not complete user logins.

If you're setting up Mari Medical on your local machine and need to set up SSL certs, look into using `mkcert` and/or a reverse proxy like `nginx` to set up localhost certificates.

After creating your app, you should be able to see the Client ID and Client Secret. Provide those to your docker compose file.
