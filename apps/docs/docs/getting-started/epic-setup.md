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

For Incoming API's, search for and select all the endpoints shown below with `left click + shift`. With all the endpoints selected, click on the `>>` button to add them to your selected list.

Make sure you've selected the following:

```
AllergyIntolerance.Read (Patient Chart) (R4)
AllergyIntolerance.Search (Patient Chart) (R4)
Binary.Read (Clinical Notes) (R4)
Binary.Read (Generated CDAs) (R4)
Binary.Read (Labs) (R4)
Binary.Search (Clinical Notes) (R4)
Binary.Search (Generated CDAs) (R4)
Binary.Search (Labs) (R4)
CarePlan.Read (Encounter) (R4)
CarePlan.Read (Longitudinal) (R4)
CarePlan.Search (Encounter) (R4)
CarePlan.Search (Longitudinal) (R4)
CareTeam.Read (Longitudinal) (R4)
CareTeam.Search (Longitudinal) (R4)
Condition.Read (Care Plan Problem) (R4)
Condition.Read (Encounter Diagnosis) (R4)
Condition.Read (Health Concerns) (R4)
Condition.Read (Problems) (R4)
Condition.Search (Care Plan Problem) (R4)
Condition.Search (Encounter Diagnosis) (R4)
Condition.Search (Health Concerns) (R4)
Condition.Search (Problems) (R4)
Coverage.Read (R4)
Coverage.Search (R4)
Device.Read (Implants) (R4)
Device.Search (Implants) (R4)
DiagnosticReport.Read (Results) (R4)
DiagnosticReport.Search (Results) (R4)
DocumentReference.Read (Clinical Notes) (R4)
DocumentReference.Read (Generated CDAs) (R4)
DocumentReference.Read (Labs) (R4)
DocumentReference.Search (Clinical Notes) (R4)
DocumentReference.Search (Generated CDAs) (R4)
DocumentReference.Search (Labs) (R4)
Encounter.Read (Patient Chart) (R4)
Encounter.Search (Patient Chart) (R4)
Goal.Read (Care Plan Goal) (R4)
Goal.Read (Patient) (R4)
Goal.Search (Care Plan Goal) (R4)
Goal.Search (Patient) (R4)
Immunization.Read (Patient Chart) (R4)
Immunization.Search (Patient Chart) (R4)
Location.Read (R4)
Location.Search (R4)
Media.Read (Study) (R4)
Media.Search (Study) (R4)
Medication.Read (R4)
Medication.Search (R4)
MedicationDispense.Read (Fill Status) (R4)
MedicationDispense.Search (Fill Status) (R4)
MedicationRequest.Read (Signed Medication Order) (R4)
MedicationRequest.Search (Signed Medication Order) (R4)
Observation.Read (Assessments) (R4)
Observation.Read (Labs) (R4)
Observation.Read (SDOH Assessments) (R4)
Observation.Read (SmartData Elements) (R4)
Observation.Read (Social History) (R4)
Observation.Read (Study Finding) (R4)
Observation.Read (Vital Signs) (R4)
Observation.Search (Assessments) (R4)
Observation.Search (Labs) (R4)
Observation.Search (SDOH Assessments) (R4)
Observation.Search (SmartData Elements) (R4)
Observation.Search (Study Finding) (R4)
Observation.Search (Vital Signs) (R4)
Organization.Read (R4)
Organization.Search (R4)
Patient.Read (Demographics) (R4)
Patient.Search (Demographics) (R4)
Practitioner.Read (R4)
Practitioner.Search (R4)
PractitionerRole.Read (Organizational Directory) (R4)
PractitionerRole.Search (Organizational Directory) (R4)
Procedure.Read (Orders) (R4)
Procedure.Read (SDOH Intervention) (R4)
Procedure.Read (Surgeries) (R4)
Procedure.Search (Orders) (R4)
Procedure.Search (SDOH Intervention) (R4)
Procedure.Search (Surgeries) (R4)
Provenance.Read (R4)
RelatedPerson.Read (Friends and Family) (R4)
RelatedPerson.Read (Proxy) (R4)
RelatedPerson.Search (Friends and Family) (R4)
RelatedPerson.Search (Proxy) (R4)
ServiceRequest.Read (Community Resource ServiceRequest) (R4)
ServiceRequest.Read (Orders) (R4)
ServiceRequest.Search (Community Resource ServiceRequest) (R4)
ServiceRequest.Search (Orders) (R4)
Specimen.Read (Patient Chart) (R4)
Specimen.Search (Patient Chart) (R4)
```

Make sure that under the `I accept the terms of use of open.epic.` line that the following line is there: **Client IDs for this app _will_ be automatically downloaded to certain customer systems upon marking it ready for production.** If it does not say _will_, authentication will not work.

You'll now need to set the redirect URI to redirect to Mere Medical. By default this is served at `https://localhost:4200/epic/callback` but depending on what your public url is will generally be in the format `{PUBLIC_URL}/epic/callback`.

Make sure that `Can Register Dynamic Clients` is selected and that `JWT Bearer grant type` is selected.

Leave `Is this app a confidential client?` unchecked.

Hit `Save`.

After you hit save, you should now see several new options appear. Configure them as follows:

- **SMART on FHIR Version**: Select `R4`
- **SMART Scope Version**: Select `SMART v2`
- **FHIR ID Generation Scheme**: Select `Use 64-Character-Limited FHIR IDs for USCDI FHIR Resources`

Skip the `Open Data Use Questionnare` - This is only needed right before we submit to production. We'll need to test our config in sandbox to make sure it is working first.

Accept the terms of use and click `Save & Ready for Sandbox`. You should now have access to a Non-Production Client ID, which we will refer to as a sandbox Client ID. Note that Epic can take several hours to fully activate your Client ID for sandbox and up to 48 hours to activate for production.

# Verifying Your Sandbox Config in Mere

Follow any of the instructions provided to get Mere running and provide the sandbox client id you just obtained in the previous step to the docker instance with EPIC_SANDBOX_CLIENT_ID_R4=Actual ID here.

To test sandbox access, go to the [Connections](https://app.meremedical.co/connections) tab in Mere, click the Log into Epic MyChart button, type `sandbox` into the search bar and select the `Sandbox` option, and log in with the test patient credentials: username `fhirjason` and password `epicepic1`.

If everything works correctly, Mere will connect to the sandbox instance.

# Submitting Your App for Production

:::warning

Once an app is submitted for production, its configuration can no longer be modified. This means that you'll need to make sure everything is working in sandbox before submitting for production.

:::

After you've verified everything works, submit your app to production and provide a new environment variable EPIC_CLIENT_ID_R4 to your docker container with the production client id accordingly.

# Troubleshooting

## Legacy DSTU2 Setup (For Existing Integrations)

:::note

These instructions are for the older DSTU2 FHIR version. **We recommend using R4 for new setups** (see main instructions above). R4 provides access to more health data types including care teams, coverage information, social determinants of health assessments, and medication dispense records.

:::

If you need to maintain an existing DSTU2 integration, follow these modified instructions:

### API Selection for DSTU2

When selecting APIs, search by **DSTU2** and select **only** the following endpoints:

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

:::warning Critical

**Unselect the following DSTU2 APIs**. If these are selected, they will prevent you from authenticating:

```
CarePlan.Read (Longitudinal) (DSTU2)
CarePlan.Search (Longitudinal) (DSTU2)
FamilyMemberHistory.Search (DSTU2)
```

:::

### DSTU2 Configuration Differences

After saving, when the additional options appear, configure them as:

- **SMART on FHIR Version**: Select `DSTU2` (not R4)
- **SMART Scope Version**: Select `SMART v2`
- **FHIR ID Generation Scheme**: Select `Use 64-Character-Limited FHIR IDs for USCDI FHIR Resources`

### DSTU2 Environment Variables

For DSTU2 integrations, use these environment variables instead:

- **Sandbox**: `EPIC_SANDBOX_CLIENT_ID` (or `EPIC_SANDBOX_CLIENT_ID_DSTU2`)
- **Production**: `EPIC_CLIENT_ID` (or `EPIC_CLIENT_ID_DSTU2`)

### Verifying DSTU2 Production Configuration

After submitting your DSTU2 app for production, verify it was configured correctly by checking the **Build Apps** tab. If your app says `CCDS Auto-Downloaded`, everything was configured correctly. If it says something like:

```
Client ID Downloads: 0
Client ID Requests: 0
Review & Manage Downloads
```

Then authentication **was not configured correctly** (most likely problem is that the wrong APIs were selected) and you'll need to start the process over by creating a new app.

:::note

This CCDS Auto-Downloaded check only applies to DSTU2 apps. R4 apps have regular client ID download behavior and don't require this specific verification step.

:::
