---
sidebar_position: 9
description: Configuring integration with NextGen Enterprise patient portals.
---

# Setting up NextGen Sync

To allow users to sync their data from practices running NextGen Enterprise, you'll need a client ID and client secret from the [NextGen API Developer Portal](https://developer.nextgen.com/). NextGen issues both immediately after you register an application, and the credentials work for the NextGen sandbox right away.

NextGen only supports confidential clients, so Mere keeps the client secret on the server: the API backend exchanges and refreshes tokens on behalf of the web app, and the secret is never sent to the browser. Both `NEXTGEN_CLIENT_ID` and `NEXTGEN_CLIENT_SECRET` must be set for the NextGen option to appear.

## Create a Developer Account

Sign up at [developer.nextgen.com](https://developer.nextgen.com/account/register). The first person to register with your email domain creates your organization and becomes its Organization Administrator, which is required to add applications.

## Register an Application

1. From the portal header, select **My Applications**, then **Add Application**.
2. Enter an application name and description.
3. In **OAuth Callback Url(s)**, enter `<PUBLIC_URL>/nextgen/callback` for each instance you host, comma-separated. For local development this is `https://localhost:4200/nextgen/callback`.
4. Leave **This application is for SMART Standalone Launch** and **This application can be launched from within the NextGen EHR** off.
5. Under **API Selection**, select **FHIR API R4** only. NextGen advises against the DSTU2 API, which is being sunset.
6. In the **FHIR API R4** configuration panel that appears, under **Requested Scopes**:
   - Enable **Does this app require Access authorization?** and check **Offline Access** only. This grants 90-day refresh tokens; without it, refresh tokens expire after one hour and users must log in again every session. Online Access is for SMART-on-FHIR user-facing apps and is not applicable.
   - Enable **Does this app require Patient authorization?** and check the **Read** column for every resource. Patients will see the selected categories on NextGen's consent screen and can approve or deny each.
7. Accept the NextGen API Terms of Service and select **Add Application**. Your `client_id` and `client_secret` are displayed immediately.

## Configuration

Set the following environment variables:

```env
NEXTGEN_CLIENT_ID=
NEXTGEN_CLIENT_SECRET=
```

## App key

With `NEXTGEN_CLIENT_SECRET` set, Mere does not start until you also set `APP_KEY`. The key signs the registration token in your invite links, which stops other apps from using your NextGen registration through your instance. One key covers Healow, NextGen, and OnPatient, so skip these steps if you already set one. You can optionally choose to disable the need for a registration token via setting your instance as a [public instance](./docker#public-instance).

1. Generate a key with `docker compose run --rm app generate-app-key`. It prints one line, such as `APP_KEY=Wo5afxExmyQKIiO1mTm0nghRWNtkwpCG`.
2. Copy that line into `.env`. If `.env` already has an empty `APP_KEY=` line, replace it.
3. Recreate the container with `docker compose up -d --force-recreate app`.
4. Print the invite link with `docker compose run --rm app generate-invite-link`.
5. Send the link to each person who uses this instance. Never send `APP_KEY` itself.

See [App key](./docker#app-key) for how the key works and how to issue a new registration token.

## Testing with the Sandbox

NextGen's sandbox uses the same OAuth and FHIR endpoints as production. Select NextGen in Mere's connections tab and log in with the sandbox test patient credentials published in the [NextGen Patient Access API Authentication Guide](https://www.nextgen.com/api/-/media/files/api/nge-patient-api-auth-guide.pdf) (username `patientapitest`).

To verify the gateway is reachable without any credentials, the R4 CapabilityStatement is public: `https://fhir.nextgen.com/nge/prod/fhir-api-r4/fhir/r4/metadata`.

## Going to Production

The same credentials serve production once your registration meets NextGen's deployment requirements — there is no separate production key. Before launch, NextGen asks Patient Access developers to email `APIpartners@nextgen.com` with your intent and any practice-facing requirements; this also lists your app in NextGen's directory of known Patient Access apps.

A patient can only connect if their practice has enabled the Patient Access API (installed NextGen's API Suite Manager and enrolled the patient). Practices using the NextGen Patient Portal let patients log in with their existing portal credentials; other practices issue dedicated Patient API credentials during enrollment. Practice enablement status is searchable at [nextgen.com/api/practice-search](https://www.nextgen.com/api/practice-search).
