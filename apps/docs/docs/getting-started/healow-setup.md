---
sidebar_position: 7
description: Configuring integration with eClinicalWorks/Healow patient portal.
---

# Setting up Healow Sync

Here we'll talk about how you can get the API access needed for Mere Medical to connect to your eClinicalWorks/Healow patient portal.

To get started, you'll need to create an eClinicalWorks developer account. You can do this by [creating an account here](https://connect4.healow.com).

Once you've created an account, you'll need to create an app registration for your self-hosted Mere instance. The goal of an app registration is to get a Client ID that can be used by your instance of Mere Medical to connect to Healow.

## Register New App

After you've logged in to the Healow developer portal, click the **Register Clinical App** button to get started with a new app registration.

![Register Clinical App](/img/healow-1-register-clinical-app.jpeg)

## App Information

Fill in the app info:

- **Specialty**: Primary Care
- **Category**: Patient Engagement
- **App Name**: Mere Medical

![App Information](/img/healow-2-app-information.jpeg)

## Scope Selection

Select all available FHIR scopes to ensure Mere Medical can access all of your health data.

![Scope Selection](/img/healow-3-scopes.jpeg)

## Other Details

Configure the remaining settings:

![Other Details](/img/healow-4-other-details.jpeg)

- **Redirect URL**: Set this to `{PUBLIC_URL}/healow/callback` where `{PUBLIC_URL}` is your Mere Medical instance URL (e.g., `https://mere.example.com/healow/callback`)
- **OpenID Connect**: Enable OpenID Connect support
- **App Type**: Configure as a public app (no client secret)

:::warning

Healow requires HTTPS for all redirect URLs. Localhost URLs are not supported. For local development, you'll need to use a tunneling service like ngrok to expose your local instance over HTTPS.

:::

## Questionnaire

Complete the required questionnaire to finish your app registration.

![Questionnaire](/img/healow-5-questionnaire.jpeg)

## Configuration

After your app is approved, you'll receive a Client ID. Add this to your Mere Medical instance:

```
HEALOW_CLIENT_ID=your-client-id-here
```

## Important Notes

:::info Token Expiration

Healow public apps do not receive refresh tokens. Users will need to re-authenticate when the access token expires (typically after 1 hour). This is a limitation of Healow's public app implementation, not Mere Medical.

:::
