---
sidebar_position: 4
description: Configuring integration with Epic MyChart patient portal.
---

# Setting up MyChart Sync

Here we'll talk about how you can get the API access needed for Mere Medical to connect to your MyChart patient portal.

To get started, you'll need to create an Epic on FHIR developer account. You can do this by [creating an account here](https://fhir.epic.com/Developer/Index).

Once you've created an account, you'll need to create an app registration for your self-hosted Mere instance. The goal of an app registration is to get a Client ID that can be used by your instance of Mere Medical to connect to your MyChart patient portal.

After you've logged in to the Epic on FHIR developer portal, go to `My Apps` and click the `+ Create` button to get started with a new app registration.

Give the app a name of `Mere Patient App`.

Application Audience will be `Patients`.

For Incoming API's, search by DSTU2 and select all the endpoints shown below with `left click + shift`. With all the endpoints selected, click on the `>>` button to add them to your selected list.

Make sure you've only selected the following:

```
AllergyIntolerance.Read (DSTU2)
AllergyIntolerance.Search (DSTU2)
Binary.Read (Generated CCDA) (DSTU2)
CarePlan.Read (Encounter-Level) (DSTU2)
CarePlan.Search (Encounter-Level) (DSTU2)
Condition.Read (Problems) (DSTU2)
Condition.Search (Problems) (DSTU2)
Device.Read (Implants) (DSTU2)
Device.Search (Implants) (DSTU2)
DiagnosticReport.Read (Results) (DSTU2)
DiagnosticReport.Search (Results) (DSTU2)
DocumentReference.Read (Generated CCDA) (DSTU2)
DocumentReference.Search (Generated CCDA) (DSTU2)
Goal.Read (Patient) (DSTU2)
Goal.Search (Patient) (DSTU2)
Immunization.Read (DSTU2)
Immunization.Search (DSTU2)
Medication.Read (DSTU2)
Medication.Search (DSTU2)
MedicationOrder.Read (DSTU2)
MedicationOrder.Search (DSTU2)
MedicationStatement.Read (DSTU2)
MedicationStatement.Search (DSTU2)
Observation.Read (Labs) (DSTU2)
Observation.Read (Social History) (DSTU2)
Observation.Read (Vitals) (DSTU2)
Observation.Search (Labs) (DSTU2)
Observation.Search (Social History) (DSTU2)
Observation.Search (Vitals) (DSTU2)
Patient.Read (DSTU2)
Patient.Search (DSTU2)
Practitioner.Read (DSTU2)
Practitioner.Search (DSTU2)
Procedure.Read (Orders) (DSTU2)
Procedure.Search (Orders) (DSTU2)
```

**Unselect the following DSTU2 APIs**. If these are selected, they will prevent you from authenticating:

```
CarePlan.Read (Longitudinal) (DSTU2)
CarePlan.Search (Longitudinal) (DSTU2)
FamilyMemberHistory.Search (DSTU2)
```

Make sure that under the `I accept the terms of use of open.epic.` line that the following line is there: **Client IDs for this app _will_ be automatically downloaded to certain customer systems upon marking it ready for production.** If it does not say _will_, authentication will not work.

You'll now need to set the redirect URI to redirect to Mere Medical. By default this is served at `https://localhost:4200/epic/callback` but depending on what your public url is will generally be in the format `{PUBLIC_URL}/epic/callback`.

Make sure that `Can Register Dynamic Clients` is selected and that `JWT Bearer grant type` is selected.

SMART on FHIR Version should be `DSTU2`.

Skip the `Open Data Use Questionnare` - This is only needed right before we submit to production. We'll need to test our config in sandbox to make sure it is working first.

Accept the terms of use and click `Save & Ready for Sandbox`. You should now have access to a Non-Production Client ID, which we will refer to as a sandbox Client ID. Note that Epic can take several hours to fully activate your Client ID for sandbox and up to 48 hours to activate for production.

# Verifying Your Sandbox Config in Mere

Follow any of the instructions provided to get Mere running and provide the sandbox client id you just obtained in the previous step to the docker instance with EPIC_SANDBOX_CLIENT_ID=Actual ID here.

To test sandbox access, go to the [Connections](https://app.meremedical.co/connections) tab in Mere, click the Log into Epic MyChart button, type `sandbox` into the search bar and select the `Sandbox` option, and log in with the test patient credentials: username `fhirjason` and password `epicepic1`.

If everything works correctly, Mere will connect to the sandbox instance.

# Submitting Your App for Production

:::warning

Once an app is submitted for production, its configuration can no longer be modified. This means that you'll need to make sure everything is working in sandbox before submitting for production.

:::

After you've verified everything works, submit your app to production and provide a new environment variable EPIC_CLIENT_ID to your docker container with the production client id accordingly. If your app says `CCDS Auto-Downloaded ` in the **Build Apps** tab, everything was configured correctly. If it says something like

```
Client ID Downloads: 0
Client ID Requests: 0
Review & Manage Downloads
```

then authentication **was not configured correctly** (most likely problem is that the wrong APIs were selected) and you'll need to start the process over by creating a new app.
