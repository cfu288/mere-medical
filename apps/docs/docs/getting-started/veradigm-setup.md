---
sidebar_position: 9
description: Configuring integration with Veradigm (formerly Allscripts) patient portals.
---

# Setting up Veradigm Sync

Here we'll talk about how you can get the API access needed for Mere Medical to connect to a Veradigm (formerly Allscripts) patient portal.

:::caution
Veradigm retired its DSTU2 FHIR API on June 1, 2025, and the legacy Unity/Touchworks sandboxes were shut down with it. Mere Medical connects through the R4 API; Veradigm connections created before the R4 migration point at retired endpoints and must be removed and re-linked.
:::

To get started, you'll need a Veradigm developer account. You can [sign up here](https://developer.veradigm.com/).

## Register a FHIR Application

After logging in to the Veradigm developer portal, open **My Dashboard** and click the **+** button on the **My FHIR Applications** tile.

Fill in the registration form:

- **App Name**: A name that clearly identifies you and your self-hosted instance (e.g. `Mere Medical`)
- **App Type**: Patient
- **App Description** and **website**: describe your instance
- **Redirect URIs**: `{PUBLIC_URL}/veradigm/callback` (e.g. `https://localhost:4200/veradigm/callback` for local development). Up to five URIs can be registered, one per line.
- **Client Type**: Public Client
- **App Type (platform)**: Web App
- **Purpose Of Use**: `patient requested` (the form itself notes patient apps should default to this)
- **Scopes**: check `launch/patient`, `openid`, `profile`, and `offline_access`, plus the patient resource scopes under the **V2 (.rs)** tab. Mere requests the `patient/*.rs` wildcard, so check all V2 patient scopes. Veradigm does not support mixing SMART v1 (`.read`) and v2 (`.rs`) scopes in a single application, so leave the V1 tab unchecked.

Saving the registration generates a **Client ID**, a secret, and a secret expiration date. Mere Medical is a public client and only needs the Client ID.

## FHIR R4 Production Access

New registrations are licensed **Test Only** for FHIR R4+: the app can connect to test organizations (including the sandbox below) immediately, but production R4 organizations are unavailable until Veradigm explicitly grants production access. Request it from the app's registration page; Veradigm processes requests within 10 days.

## Sandbox Testing

Veradigm's current test environment is the Partner Training Environment (`CP00101`), which serves FHIR R4:

| Property | Value |
| --- | --- |
| FHIR Base URL | `https://fhir.fhirpoint.open.allscripts.com/fhirroute/open/CP00101/` |
| Authorize URL | `https://open.allscripts.com/fhirroute/patientauthv2/afdc1f7b-b362-4777-8ab3-83472abd0b8a/connect/authorize` |
| Token URL | `https://open.allscripts.com/fhirroute/patientauthv2/afdc1f7b-b362-4777-8ab3-83472abd0b8a/connect/token` |

These are the patient-access endpoints declared by the sandbox's own CapabilityStatement; the `/fhirroute/fhir/CP00101/` base and `authorizationV2` URLs seen elsewhere in Veradigm's docs are the provider-facing equivalents.

Test login credentials are not published; you must [request them from Veradigm](https://developer.veradigm.com/Fhir/FHIR_Sandboxes). Despite the `/open/` route naming used in some Veradigm materials, every resource call against this environment requires an OAuth access token.

## Configuration

Add your Client ID to your Mere Medical instance:

```
VERADIGM_CLIENT_ID=your-client-id-here
```

For support, contact VeradigmConnect@veradigm.com through the developer portal.
