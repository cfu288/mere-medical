---
sidebar_position: 5
description: Configuring integration with OnPatient patient portal.
---

# Setting up OnPatient Sync

:::note

OnPatient unfortunately has a poor implementation of the FHIR DSTU2 standard for their patient facing api's. This means that some data will not be properly synced, such as lab panel results (CBC, CMP). For these panel results, they do not include the name of the individual components of the panel so you can't know which result is which. OnPatient office visits may also appear as procedures.

:::

:::warning

There is a technical limitation in OnPatient that prevents the Mere Medical web app from securely authenticating directly with OnPatient. Therefore, in order for Mere Medical to access your medical records on your behalf, Mere Medical intercepts the login redirect from OnPatient via a backend endpoint and then forwards the access token to your web app. If you are not hosting this app yourself, this means that whoever is hosting the app for you can potentially intercept this request and login credentials.

:::

Here we'll talk about how you can get the API keys and secrets needed for Mere Medical to connect to your OnPatient patient portal.

You'll need to get a client secret and client id value from the OnPatient patient portal. You can do this by visiting your [OnPatient account settings page](https://www.onpatient.com/account/settings/) and clicking `Edit` in the box that says `FHIR API Application Management`. Click `Add New App` and enter a name for the app (any name is fine, you can write `Mere` for clarity).

You'll now need to set the redirect URI to redirect to Mere Medical. By default this is served at `https://localhost:4200/api/v1/onpatient/callback` but depending on what your public url is will generally be in the format `{PUBLIC_URL}/api/v1/onpatient/callback`. Note that the url schema must be HTTPS and not HTTP or OnPatient will not complete user logins.

OnPatient requires an HTTPS redirect URL, so Mere needs a real domain name behind a reverse proxy. See [running behind a reverse proxy](./docker#running-behind-a-reverse-proxy).

After creating your app, you should be able to see the Client ID and Client Secret. Provide those to your docker compose file.

## App key

With `ONPATIENT_CLIENT_SECRET` set, Mere does not start until you also set `APP_KEY`. The key signs the registration token in your invite links, which stops other apps from using your OnPatient registration through your instance. One key covers Healow, NextGen, and OnPatient, so skip these steps if you already set one. You can optionally choose to disable the need for a registration token via setting your instance as a [public instance](./docker#public-instance).

1. Generate a key with `docker compose run --rm app generate-app-key`. It prints one line, such as `APP_KEY=Wo5afxExmyQKIiO1mTm0nghRWNtkwpCG`.
2. Copy that line into `.env`. If `.env` already has an empty `APP_KEY=` line, replace it.
3. Recreate the container with `docker compose up -d --force-recreate app`.
4. Print the invite link with `docker compose run --rm app generate-invite-link`.
5. Send the link to each person who uses this instance. Never send `APP_KEY` itself.

See [App key](./docker#app-key) for how the key works and how to issue a new registration token.
