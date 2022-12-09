---
sidebar_position: 4
description: Configuring integration with Epic MyChart patient portal.
---

# Setting up MyChart Sync

Here we'll talk about how you can get the API access needed for Mari Medical to connect to your MyChart patient portal.

You'll need to get a client id value from the Epic On FHIR portal. You can do this by [creating an account here](https://fhir.epic.com/Developer/Index).

After you've logged in, go to `My Apps` and create and app. Give the app a name of `Mari Patient App`. Application Audience will be `Patients`. For Incoming API's, search by DSTU2 and select all the endpoints below with `left click + shift`. With all the endpoints selected, click on the `>>` button to add them to your selected list.

You'll now need to set the redirect URI to redirect to Mari Medical. By default this is served at `https://localhost:4200/epic/callback` but depending on what your public url is will generally be in the format `{PUBLIC_URL}//epic/callback`.

Make sure that `Can Register Dynamic Clients` is selected and that `JWT Bearer grant type` is selected.

SMART on FHIR Version should be `DSTU2`.

Skip the `Open Data Use Questionnare` - This is only needed for production systems. We'll need to test our config in sandbox to make sure it is working first. Once an app is submitted for production, its configuration can no longer be modified.

Accept the terms of use and click `Save & Ready for Sandbox`. After creating your app, you should be able to see the Client ID. Provide those to your docker compose file. Use the Non-Production Client ID in your docker env and make sure you can now log in with a test patient (username `fhirjason` and password `epicepic1`). Note that epic can take several hours to fully activate your config.

After you've verified everything works, submit your app to production and update your client id accordingly.
