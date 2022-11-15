---
sidebar_position: 2
---

# Setting up OnPatient Sync

Here we'll talk about how you can get the API keys and secrets needed for Mari Medical to connect to your OnPatient patient portal.

Due to limitations in OnPatient's API's, in order for Mari Medical to access your medical records on your behalf, you'll need to get a client secret and client id value from the OnPatient patient portal. You can do this by visiting your [OnPatient account settings page](https://www.onpatient.com/account/settings/) and clicking `Edit` in the box that says `FHIR API Application Management`. Click `Add New App` and enter a name for the app (any name is fine, you can write `Mari` for clarity).

You'll now need to set the redirect URI to redirect to the API part of Mari Medical. By default this is served at `https://localhost:4201/api/v1/onpatient/callback`. Note that the url schema must be HTTPS and not HTTP or OnPatient will not complete user logins.

If you're setting up Mari Medical on your local machine and need to set up SSL certs, look into using `mkcert` and/or a reverse proxy like `nginx` to set up localhost certificates.

After creating your app, you should be able to see the Client ID and Client Secret. Provide those to your docker compose file.
