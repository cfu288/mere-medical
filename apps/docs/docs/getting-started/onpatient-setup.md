---
sidebar_position: 3
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

If you're setting up Mere Medical on your local machine and need to set up SSL certs, look into using `mkcert` and/or a reverse proxy like `nginx` to set up localhost certificates.

After creating your app, you should be able to see the Client ID and Client Secret. Provide those to your docker compose file.
