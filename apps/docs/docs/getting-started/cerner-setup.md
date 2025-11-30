---
sidebar_position: 5
description: Configuring integration with Cerner Health patient portal.
---

# Setting up Cerner Health Sync

Here we'll talk about how you can get the API access needed for Mere Medical to connect to your Cerner patient portal.

You'll need to get a client id value from the Cerner Code console. You can do this by [creating an account here](https://code-console.cerner.com/).

After you've logged in, click the `Go To My Applications` button and create and app. Give the app a name of `Mere Patient App`. Application type will be `Patients`. Select `offline` for type of access. Select `Public` for application privacy.

You'll now need to set the redirect URI to redirect to Mere Medical. By default this is served at `https://localhost:4200/cerner/callback` but depending on what your public url is will generally be in the format `{PUBLIC_URL}/cerner/callback`.

You can leave the rest blank and click `Next`.

Under product family, select `Millennium`. Under select products, check `Ignite APIs for Millennium: FHIR R4, All`. Click `Next`.

On the next page, check off every box under `Patient Product APIs` and `User Product APIs`. Agree to the terms of use and click `Submit`.

At this point, you should be able to see your client id.

# Troubleshooting

## Using Legacy DSTU2 Version

These instructions use FHIR R4, which is the current standard and provides access to more health data types. If you have an existing DSTU2 integration that you need to maintain, you can select `Ignite APIs for Millennium: FHIR DSTU 2, All` instead of the R4 version in step 18.
