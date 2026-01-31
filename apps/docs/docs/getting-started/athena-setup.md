---
sidebar_position: 8
description: Configuring integration with Athena Health patient portal.
---

# Setting up Athena Sync

Here we'll talk about how you can get the API access needed for Mere Medical to connect to your Athena Health patient portal.

To get started, you'll need to create an Athena Health developer account. You can do this by [creating an account here](https://developer.api.athena.io/ams-portal/apps).

Once you've created an account, you'll need to create an app registration for your self-hosted Mere instance. The goal of an app registration is to get a Client ID that can be used by your instance of Mere Medical to connect to Athena Health.

## Create a New App

After you've logged in to the Athena developer portal, click the **Create a New App** button to get started with a new app registration.

![Create a New App](/img/Athena-1-CreateNewApp.png)

## Select API Access and App Category

Configure your API access and authentication settings:

- **API Access**: Select "My app will use Certified APIs ONLY"
- **App Category**: Select "3-Legged OAuth for Patients"
- Check "I confirm that I am building a PHR app"
- Click **Continue to App Details**

![Certified API and Auth Selection](/img/Athena-2-CertifiedApiAndAuth.jpeg)

## App Registration Details

Fill in the app registration form:

- **App Name**: Mere Medical
- **Description**: A personal health record app for managing your medical data
- **Environment**: Preview (for testing)
- **End Users**: "No, only the patient can access their own health record"
- **Application Type**: Browser
- **Authentication Method**: Proof Key for Code Exchange (PKCE)
- **Post-Login Redirect URL**: `https://localhost:4200/athena/callback` (or `{PUBLIC_URL}/athena/callback` for your hosted instance)
- Agree to the Terms and Conditions
- Click **Create Application**

![App Registration Details](/img/Athena-3-AppRegistration.jpeg)

## Configure Scopes

After creating your app, you need to configure the API scopes. Click on your newly created app, then navigate to the **Scopes** tab and click **Edit Scopes**.

![Scopes Tab](/img/Athena-4.1-Scopes.jpeg)

Select **FHIR R4 SMART V2** from the left sidebar, then check all **Read** scopes to allow Mere Medical to access your health data. Click **Confirm Scopes** when done.

![FHIR R4 SMART V2 Scopes](/img/Athena-4.2-r4Scopes.jpeg)

## Get Your Client ID

After clicking Create Application, a popup will display your Client ID. Save this value for the next step.

## Configuration

Add your Client ID to your Mere Medical instance:

```
ATHENA_CLIENT_ID=your-client-id-here
```
