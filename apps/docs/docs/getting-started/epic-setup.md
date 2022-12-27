---
sidebar_position: 4
description: Configuring integration with Epic MyChart patient portal.
---

# Setting up MyChart Sync

Here we'll talk about how you can get the API access needed for Mere Medical to connect to your MyChart patient portal.

You'll need to get a client id value from the Epic On FHIR portal. You can do this by [creating an account here](https://fhir.epic.com/Developer/Index).

After you've logged in, go to `My Apps` and create and app. Give the app a name of `Mere Patient App`. Application Audience will be `Patients`. For Incoming API's, search by DSTU2 and select all the endpoints shown below with `left click + shift`. With all the endpoints selected, click on the `>>` button to add them to your selected list.

Make sure you've only selected the following:

```
AllergyIntolerance.Read
AllergyIntolerance.Search
Binary.Read
CarePlan.Read
CarePlan.Search
Condition.Read
Condition.Search
Device.Read
Device.Search
DiagnosticReport.Read
DiagnosticReport.Search
DocumentReference.Read
DocumentReference.Search
Goal.Read
Goal.Search
Immunization.Read
Immunization.Search
Medication.Read
Medication.Search
MedicationOrder.Read
MedicationOrder.Search
MedicationStatement.Read
MedicationStatement.Search
Observation.Read
Observation.Search
Patient.Read
Patient.Search
Practitioner.Read
Practitioner.Search
Procedure.Read
Procedure.Search
```

Make sure that the DSTU2 `FamilyMemberHistory.Search` is not selected. This will prevent you from authenticating if selected.

Make sure that under the `I accept the terms of use of open.epic.` line that the following line is there: **Client IDs for this app _will_ be automatically downloaded to certain customer systems upon marking it ready for production.** If it does not say _will_, authentication will not work.

You'll now need to set the redirect URI to redirect to Mere Medical. By default this is served at `https://localhost:4200/epic/callback` but depending on what your public url is will generally be in the format `{PUBLIC_URL}/epic/callback`.

Make sure that `Can Register Dynamic Clients` is selected and that `JWT Bearer grant type` is selected.

SMART on FHIR Version should be `DSTU2`.

Skip the `Open Data Use Questionnare` - This is only needed for production systems. We'll need to test our config in sandbox to make sure it is working first. Once an app is submitted for production, its configuration can no longer be modified.

Accept the terms of use and click `Save & Ready for Sandbox`. After creating your app, you should be able to see the Client ID. Provide those to your docker compose file. Use the Non-Production Client ID in your docker env and make sure you can now log in with a test patient (username `fhirjason` and password `epicepic1`). Note that epic can take several hours to fully activate your config.

After you've verified everything works, submit your app to production and update your client id accordingly. If your app says `CCDS Auto-Downloaded ` in the **Build Apps** tab, everything was configured correctly. If it says something like

```
Client ID Downloads: 0
Client ID Requests: 0
Review & Manage Downloads
```

then authentication was not configured correctly and you'll need to start the process over by creating a new app.
