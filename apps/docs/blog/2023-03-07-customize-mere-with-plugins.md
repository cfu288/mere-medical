---
slug: exploring-extensibility-with-cds-hooks
title: Personalizing Your Personal Health Record with Plugins
description: A proposal to supercharge your personal health record with third-party CDS hooks
authors:
  name: Christopher Fu
  title: Developer of Mere Medical
  url: https://cfu288.com
  image_url: https://files.mari.casa/profile.jpg
---

Currently, personal health records (PHRs) such as Mere do a great job of syncing and showing you your medical records across different healthcare providers. Mere makes it easy to read and search for your medical records across multiple health systems. Want to see what your last red blood cell count was? Mere can show you. Want to compare your last red blood cell count to your previous lab results? Mere will generate a graph for you. Don't remember which vaccines you've already gotten? Mere can group and summarize your entire vaccine history in one view.

PHRs such as Mere are excellent at storing and showing you your medical data. But there's a big difference between just _showing_ you your data and actually _providing insights_ into your data.

The next problem Mere wants to solve is this: how can Mere make your data _actionable_? How can Mere help you learn more about yourself and your conditions? Can Mere recommend actions you can take to improve your health? And can Mere do all this while maintaining its core tenants of privacy, local-first data, and user autonomy?

There are many different ways Mere _could_ provide health insights to users where it currently does not. If you're using Mere to manage medical records for your child, you could track their vaccine immunization history, and Mere could remind you when your next vaccine appointment should be. If you've recently become pregnant, Mere could help remind you when you should see your doctor, which screenings to get, and when. Mere could help you find the lowest prices for your current medications. Given your history, Mere could use AI to make more intelligent predictions or highlight risk factors. Mere could implement many possible features like this - but features that may be helpful for one person may be useless to another. Even if Mere could build every feature, only some people may want to enable such features.

That's why one of the future goals of Mere is to allow for customization through opt-in plugins that users can enable. The long-term goal is to offer a plugin marketplace to allow for third-party developers to publish extensions to Mere so that users and patients can customize their experience.

# Where HL7 comes into play

There are a few ways that Mere can offer this plugin-ability from a technical standpoint. Given Mere's strong basis in HL7 healthcare standards, it makes sense to explore what other HL7 standards exist already that allow for clinical client extensibility in healthcare. There have not been many proposals exploring extensibility in personal health records (PHRs) specifically, but HL7 has established some standards that allow for extensibility in other clinical client applications like electronic medical records (EMRs) that doctors and providers use.

HL7 specifies two significant ways that clinical clients, usually referring to EMRs, can implement extensibility:

- Using [HL7 Clinical Decision Support (CDS) hooks standard](https://cds-hooks.org/). CDS hooks allow third-party developers to create actionable cards displayed directly to providers inside the EMR. These cards augment the providers' experience, providing real-time insights into their data.
- Using [SMART on FHIR applications](https://www.hl7.org/fhir/smart-app-launch/) to embed third-party clinical apps that can be embedded in the EHR and provide completely different experiences currently not possible in the EMR.

In this post, we will dive deeper into how PHRs can adopt CDS hooks to enable extensibility.

# Looking to the future

The point of this post isn't to say that Mere has already implemented this standard and is ready for CDS hook-based plugins today but to lay the groundwork and discuss how the CDS hook standard may need to be updated to handle PHR use cases. This following paragraphs might only make sense if you've already read the [HL7 Clinical Decision Support (CDS) hooks standard](https://cds-hooks.org/).

The great thing about building off a current standard like CDS hooks is that CDS hooks built for one PHR could be used for any PHR!

To quickly summarize CDS hooks - they're HTTP web hooks that get called whenever a user of a clinical client, such as a EMR, takes a specific action, like when a provider opens a patient's chart or starts a medication order for a patient. The idea is that registered third-party apps can be called whenever one of these actions is triggered and provide real-time feedback to the user about their actions. So, for example, a CDS application that can listen for when a doctor is entering a medication order for a specific drug in the EMR can suggest a different medication via a card in the UI of the EMR:

![CDS hook flow](https://cds-hooks.org/images/overview.png)

The CDS hook standard was primarily built for EMR systems and makes several assumptions:

- There is a single FHIR store from which the third-party CDS hook can fetch the current patients records from
- The hook trigger types are related to a clinical or EMR action.

There are a few reasons why these assumptions cause issues for PHRs:

- PHRs may pull data from multiple sources, not a single FHIR source
- Most of the currenly specified hook types, e.g. the `patient-view` hook, don't really make sense in PHRs as every view is a patient view. Other hooks like `medication-prescribe` and `order-review` are not actions users of a PHR would make.
- PHRs may not expose a FHIR endpoint, especially if they are local-first like Mere is. It is unreasonable to expect client PHRs to implement the entire FHIR server standard.

These assumptions limit the ability of PHRs to use CDS hooks in their current state today. Digging a little deeper into the anatomy of a CDS HTTP call, we can see how we can update the spec to better work around these limitations.

Currently, CDS hooks expect the following properties in the JSON body of a call :

| Field             | Optionality | Type   | Description                                                                                                                                                                                                                                     |
| ----------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hook              | REQUIRED    | string | The hook that triggered this CDS Service call. See Hooks.                                                                                                                                                                                       |
| hookInstance      | REQUIRED    | string | A universally unique identifier (UUID) for this particular hook call (see more information below).                                                                                                                                              |
| fhirServer        | CONDITIONAL | URL    | The base URL of the CDS Client's FHIR server. If fhirAuthorization is provided, this field is REQUIRED. The scheme MUST be https when production data is exchanged.                                                                             |
| fhirAuthorization | OPTIONAL    | object | A structure holding an OAuth 2.0 bearer access token granting the CDS Service access to FHIR resources, along with supplemental information relating to the token. See the FHIR Resource Access section for more information.                   |
| context           | REQUIRED    | object | Hook-specific contextual data that the CDS service will need.For example, with the patient-view hook this will include the FHIR id of the Patient being viewed. For details, see the Hooks specific specification page (example: patient-view). |
| prefetch          | OPTIONAL    | object | The FHIR data that was prefetched by the CDS Client (see more information below).                                                                                                                                                               |

An example of a call to a CDS endpoint from a clinical client would currently look like this:

```bash
curl
-X POST \
  -H 'Content-type: application/json' \
  --data @hook-details-see-example-below \
  "https://example.com/cds-services/static-patient-greeter"
```

```json
{
  "hookInstance": "d1577c69-dfbe-44ad-ba6d-3e05e953b2ea",
  "fhirServer": "http://hooks.smarthealthit.org:9080",
  "hook": "patient-view",
  "fhirAuthorization": {
    "access_token": "some-opaque-fhir-access-token",
    "token_type": "Bearer",
    "expires_in": 300,
    "scope": "user/Patient.read user/Observation.read",
    "subject": "cds-service4"
  },
  "context": {
    "userId": "Practitioner/example",
    "patientId": "1288992",
    "encounterId": "89284"
  },
  "prefetch": {
    "patientToGreet": {
      "resourceType": "Patient",
      "gender": "male",
      "birthDate": "1925-12-23",
      "id": "1288992",
      "active": true
    }
  }
}
```

Based on some of the limitations we discussed above, I'd suggest the following updates to the spec:

1. The `hook` field should be expanded to handle use cases commonly found in a PHR. This isn't a technical limitation of the current spec, but as common use cases start to converge from multiple PHR implementations, it may make sense to standardize several of them so that hooks can be transferrable across PHR implementations.

2. The `fhirServer` and `fhirAuthorization` fields may need to handle multiple or zero FHIR servers. Since not all PHRs may implement their own FHIR endpoint but may want to provide credentials to their sources, those fields should be able to handle multiple servers with multiple authorization credentials. On the other hand, some PHRs may just want to send over the relevant FHIR resources in the context, with zero references to external FHIR sources. One way to do this (while maintaining backward compatibility with existing hooks) would be to allow for a `fhirSources` array, where each array element contains a `fhirServer` element and a `fhirAuthorization` element. An example of this would be below:

```json
{
  "hookInstance": "d1577c69-dfbe-44ad-ba6d-3e05e953b2ea",
  "hook": "patient-view",
  "fhirServices": [
    {
      "fhirServer": "http://hooks.smarthealthit.org:9080",
      "fhirAuthorization": {
        "access_token": "some-opaque-fhir-access-token",
        "token_type": "Bearer",
        "expires_in": 300,
        "scope": "user/Patient.read user/Observation.read",
        "subject": "cds-service4"
      }
    },
    {
      "fhirServer": "http://hooks.smarthealthit.org:9090",
      "fhirAuthorization": {
        "access_token": "some-opaque-fhir-access-token",
        "token_type": "Bearer",
        "expires_in": 300,
        "scope": "user/Patient.read user/Observation.read",
        "subject": "cds-service4"
      }
    }
  ],
  "context": {
    "userId": "Practitioner/example",
    "patientId": "1288992",
    "encounterId": "89284",
    "additionalData": {
      ...
    }
  },
  "prefetch": {
    "patientToGreet": {
      "resourceType": "Patient",
      "gender": "male",
      "birthDate": "1925-12-23",
      "id": "1288992",
      "active": true
    }
  }
}
```

Note that there are still some problems that need to be solved with this approach, like how a PHR will get access tokens to their sources that have a different scope provided to the PHR app itself (e.g. the PHR may have read access to all resource types but may only want to provide an access token to a hook with read access to AlleryIntolerance resources)

This post is still a work in progress and will likely evolve as PHR use cases are discovered and solidified. If you have more ideas about CDS hooks for PHR or want to start a discussion, please [shoot me an email](mailto:cfu288@meremedical.co) and I can edit this post.
