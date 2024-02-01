---
slug: exploring-extensibility-with-cds-hooks-part-2
title: Digging Deeper into CDS Hooks for Personal Health Records
description: A proposal to supercharge your personal health record with third-party CDS hooks
authors: [cfu288]
toc_min_heading_level: 2
toc_max_heading_level: 5
hide_table_of_contents: false
---

This post will dive deeper into how personal health records (PHRs) can adopt the Clinical Decision Support (CDS) hooks standard to enable third-party extensibility. We're primarily focusing on CDS hooks because it is a more accessible standard for PHRs and third-party developers to adapt. For a high level context of why we care about this, please read [Part 1](/blog/exploring-extensibility-with-cds-hooks).

The point of this post is to lay the groundwork and discuss how the CDS hook standard may need to be updated to handle PHR use cases. The great thing about building off a current standard like CDS hooks is that CDS hooks built for one PHR could be used for any PHR. For a deeper dive on CDS Hooks, read the [HL7 Clinical Decision Support (CDS) hooks documentation](https://cds-hooks.org/).

<!--truncate-->

## Overview of CDS Hooks and their Limitations in Personal Health Records

To quickly summarize CDS hooks - they're HTTP webhooks that get called whenever a user of a clinical client, such as an Electronic Medical Record (EMR), takes a specific action. Examples of these actions include when a provider opens a patient's chart or when a provider starts a medication order for a patient. The idea is that registered third-party apps can be called whenever one of these actions is triggered and provide real-time feedback to the user about their actions. So, for example, a CDS application that can listen for when a doctor is entering a medication order for a specific drug in the EMR can suggest a different medication via a card in the UI of the EMR:

![CDS hook flow](https://cds-hooks.org/images/overview.png)

The CDS hook standard was primarily built for EMR systems and makes several assumptions:

- There is a single FHIR store from which the third-party CDS hook can fetch the current patients records from
- The hook trigger types are related to a clinical or EMR action.

There are a few reasons why these assumptions cause issues for PHRs:

- PHRs may pull data from multiple sources, not a single FHIR source
- Most of the currently specified hook types, e.g. the `patient-view` hook, don't make sense in PHRs as every view is a patient view. Other hooks like `medication-prescribe` and `order-review` are not actions users of a PHR would make.
- PHRs may not expose an FHIR endpoint, especially if they are local-first like Mere is. Expecting PHRs to implement the entire FHIR server standard is unreasonable.

These assumptions limit the ability of PHRs to use CDS hooks in their current state.

### Existing CDS Hooks Specification Technical Overview

[If you're already familiar with the CDS hooks technical implementation, feel free to jump to my proposed updates to the CDS spec](#what-needs-to-change-with-cds-hooks-to-work-with-personal-health-records).

Let us dig deeper into how CDS hooks work technically.

First, all CDS hooks offered by a service are exposed via a discovery endpoint. The discovery endpoint reveals metadata that lets a clinical client know which CDS hooks are available from that service. The discovery endpoint is typically found at the url `{baseURL}/cds-services` and would return an array of hook metadata objects. Each object would have the following properties:

| Field             | Optionality | Type   | Description                                                                                                                                                                                                                                                                                       |
| ----------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hook              | REQUIRED    | string | The hook this service should be invoked on. See Hooks.                                                                                                                                                                                                                                            |
| title             | RECOMMENDED | string | The human-friendly name of this service.                                                                                                                                                                                                                                                          |
| description       | REQUIRED    | string | The description of this service.                                                                                                                                                                                                                                                                  |
| id                | REQUIRED    | string | The {id} portion of the URL to this service which is available at{baseUrl}/cds-services/{id}                                                                                                                                                                                                      |
| prefetch          | OPTIONAL    | object | An object containing key/value pairs of FHIR queries that this service is requesting the CDS Client to perform and provide on each service call. The key is a string that describes the type of data being requested and the value is a string representing the FHIR query.See Prefetch Template. |
| usageRequirements | OPTIONAL    | string | Human-friendly description of any preconditions for the use of this CDS Service.                                                                                                                                                                                                                  |

A call to the endpoint would look something like this:

```json
{
  "services": [
    {
      "hook": "patient-view",
      "title": "Static CDS Service Example",
      "description": "An example of a CDS Service that returns a static set of cards",
      "id": "static-patient-greeter",
      "prefetch": {
        "patientToGreet": "Patient/{{context.patientId}}"
      }
    },
    {
      "hook": "order-select",
      "title": "Order Echo CDS Service",
      "description": "An example of a CDS Service that simply echoes the order(s) being placed",
      "id": "order-echo",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "medications": "MedicationRequest?patient={{context.patientId}}"
      }
    },
    {
      "hook": "order-sign",
      "title": "Pharmacogenomics CDS Service",
      "description": "An example of a more advanced, precision medicine CDS Service",
      "id": "pgx-on-order-sign",
      "usageRequirements": "Note: functionality of this CDS Service is degraded without access to a FHIR Restful API as part of CDS recommendation generation."
    }
  ]
}
```

Now let us dig into a specific hook, which would be called at `{baseURL}/cds-services/{id-from-discovery-url-metadata}`

Currently, CDS hooks expect the following properties in the JSON body of a call :

| Field             | Optionality | Type   | Description                                                                                                                                                                                                                                     |
| ----------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hook              | REQUIRED    | string | The hook that triggered this CDS Service call. See Hooks.                                                                                                                                                                                       |
| hookInstance      | REQUIRED    | string | A universally unique identifier (UUID) for this particular hook call (see more information below).                                                                                                                                              |
| fhirServer        | CONDITIONAL | URL    | The base URL of the CDS Client's FHIR server. If fhirAuthorization is provided, this field is REQUIRED. The scheme MUST be https when production data is exchanged.                                                                             |
| fhirAuthorization | OPTIONAL    | object | A structure holding an OAuth 2.0 bearer access token granting the CDS Service access to FHIR resources, along with supplemental information relating to the token. See the FHIR Resource Access section for more information.                   |
| context           | REQUIRED    | object | Hook-specific contextual data that the CDS service will need.For example, with the patient-view hook this will include the FHIR id of the Patient being viewed. For details, see the Hooks specific specification page (example: patient-view). |
| prefetch          | OPTIONAL    | object | The FHIR data that was prefetched by the CDS Client (see more information below).                                                                                                                                                               |

An example of a request to a CDS endpoint from a clinical client would currently look like this:

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

Which would return the following response to be rendered to the clinical client:

```json
{
  "cards": [
    {
      "uuid": "44a7eb84-ce90-45ac-a85b-04fdb4e76679",
      "summary": "Now seeing: Daniel",
      "source": {
        "label": "Patient greeting service"
      },
      "indicator": "info"
    }
  ]
}
```

## What needs to change with CDS hooks to work with Personal Health Records

Based on the limitations discussed above, I'd suggest the following updates to the CDS specification:

#### Updating the `hook` Field to Handle PHR Actions and Use Cases

The `hook` field should be expanded to handle use cases commonly found in a PHR. For example, current hook types such as `patient-view`, `medication-prescribe` and `order-review` are very EMR centric and don't apply to PHRs.

It may make sense to introduce hooks that tie into the lifecycle events of the PHR, like a `app-start` hook that executes when the PHR starts, or a `open-diagnostic-report`/`open-observation` hook that is called whenever a patient decides to look at a specific set of lab values.

This limitation isn't a technical limitation of the current spec and is more because common PHR use cases have not been explored yet. As these use cases are discovered and converge across multiple PHR implementations, it may make sense to standardize several of them so that hooks can be transferrable across PHR implementations.

#### Updating the Hook Body to Handle Multiple FHIR Servers as Sources

The `fhirServer` and `fhirAuthorization` fields currently allow a hook to define a single FHIR server. Unless a PHR has also implemented its own FHIR server for external services to call, it is unlikely that this is a practical expectation for PHRs. Most PHRs that want to share FHIR resources with a hook would likely want to do so via one of two methods:

1. Send a list of `fhirServer`/`fhirAuthorization` tuples that the PHR itself uses so that the hook can pull the resources from the FHIR servers itself or
2. Send over just the required FHIR resources needed for the hook to execute as a property the `context` field of the hook with zero `fhirServer`/`fhirAuthorization` values provided.

One way to do this (while maintaining backward compatibility with existing hooks) would be to allow for a `fhirSources` array, where each array element contains a `fhirServer` element, a `fhirAuthorization` element.

So to summarize, in a CDS hook that does not require any external `fhirServer` to fetch data from, the properties `fhirServer`, `fhirAuthorization`, and `fhirSources` should be null or undefined. In a hook that requires exactly one external FHIR server, both the `fhirServer` and `fhirAuthorization` properties should be provided. In cases where the hook may expect one or more external FHIR server, the `fhirSources` array should be populated, and both `fhirServer` and `fhirAuthorization` should be null or undefined.

The `context` property would need to be updated as well. The `context` property technically can contain any data, but most hooks usually provide a `userId`, `patientId`, and `encounterId` as fields. These variables are primarily intended to be passed to the hook as "parameters" but can also be parameters used within the prefetch templates - essentially used to replace values in in the template strings. However, these three properties are usually specific to a single FHIR server. Therefore, if we want to pass multiple `fhirServers` as specified above, each will require its unique context to reference, especially when referring to prefetch templates.

To solve this problem in a backward-compatible way, we would introduce a new `contexts` root property that would act similarly to the current `context` property, however, the `contexts` object would contain key:value properties where the key would be the value of the `fhirServer` to apply the context to and the value would be a context values specific to the `fhirServer` specified. In addition, any objects provided inside the `contexts` object would act as an override for the more generic `context` object. For this reason, both the `context` and `contexts` root properties can co-exist.

An example of how the new `fhirServices` property and the new `contexts` property would work together is shown below:

**Discovery Endpoint**

```json
{
  "services": [
    {
      "hook": "patient-view",
      "title": "Static CDS Service Example",
      "description": "An example of a CDS Service that returns a static set of cards",
      "id": "static-patient-greeter",
      "prefetch": {
        "patientsToGreet": "Patient/{{context.patientId}}"
      }
    }
  ]
}
```

**CDS Hook Body**

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
  "contexts": {
    "http://hooks.smarthealthit.org:9080": {
      "userId": "Practitioner/example",
      "patientId": "1288992",
      "encounterId": "89284"
    },
    "http://hooks.smarthealthit.org:9090": {
      "userId": "Practitioner/example2",
      "patientId": "1288994",
      "encounterId": "89285"
    }
  },
  "prefetch": {
    "patientsToGreet": {
      "resourceType": "Bundle",
      "entry": [
        {
          "resourceType": "Patient",
          "gender": "male",
          "birthDate": "1925-12-23",
          "id": "1288992",
          "active": true
        },
        {
          "resourceType": "Patient",
          "gender": "male",
          "birthDate": "1925-12-23",
          "id": "1288993",
          "active": true
        }
      ]
    }
  }
}
```

Note that there are still some problems that need to be solved with this approach, like how a PHR will get access tokens to their sources that have a different scope provided to the PHR app itself (e.g. the PHR may have read access to all resource types but may only want to provide an access token to a hook with read access to AlleryIntolerance resources).

#### Make the Discovery Endpoint Expose what Properties are Expected in the Context

So admittedly, this next point is more of a _nice-to-have_ instead of a _need-to-have_, but something I thought I would propose anyways.

The `context` field should be added to the CDS discovery endpoint and define the clinical client's expected properties. By doing this, we make the discovery of the required fields for a hook machine-parsable. This means that clinical clients can decide whether they can provide additional data into the context of the the hook automatically without an external developer needing to add explicit support for each additional context property. Each element in the `context` field of the discovery endpoint would be a key:value pair, where the key was the name of the context item, and the value was a [CodableConcept](https://build.fhir.org/datatypes.html#CodeableConcept) representing the data type to be populated by the clinical client. See below for an example.

```json
{
  "services": [
    {
      "hook": "patient-view",
      "title": "Static CDS Service Example",
      "description": "An example of a CDS Service that returns a static set of cards",
      "id": "static-patient-greeter",
      "context": {
        "userId": {
          "coding": [
            {
              "system": "https://cds-hooks.org/hooks/patient-view/#context",
              "code": "1",
              "display": "The id of the current user. Must be in the format [ResourceType]/[id]"
            }
          ],
          "text": "The id of the current user. Must be in the format [ResourceType]/[id]"
        },
        "patientId": {
          "coding": [
            {
              "system": "https://cds-hooks.org/hooks/patient-view/#context",
              "code": "2",
              "display": "The FHIR Patient.id of the current patient in context"
            }
          ],
          "text": "The FHIR Patient.id of the current patient in context"
        },
        "encounterId": {
          "coding": [
            {
              "system": "https://cds-hooks.org/hooks/patient-view/#context",
              "code": "3",
              "display": "The FHIR Encounter.id of the current encounter in context"
            }
          ],
          "text": "The FHIR Encounter.id of the current encounter in context"
        }
      },
      "prefetch": {
        "patientsToGreet": "Patient/{{contexts.patientId}}"
      }
    }
  ]
}
```

## What This Proposal Does Not Touch On

Adapting this standard to PHRs will open up some questions and considerations that don't necessarily apply to EHR clinical clients. For now I'll leave the handling of these specific questions down to implementers, but I'll mention a few considerations here:

- What is the user flow for fetching and providing `fhirAuthorization` access tokens that have a narrower scope than the PHR parent app has? If a user has multiple FHIR sources, what is the user experience for granting access to only some of the sources to a hook?
- How will PHR apps handle enabling and disabling of individual hooks? How can PHRs allow end users to add their own CDS discovery urls and hooks?

## Proposed CDS Hooks For Personal Health Records

I'm still working on an initial spec for some PHR focused CDS hooks, which I'll explore in our next blog post. Stay tuned!

## To Be Continued?

This post is still a work in progress and will likely evolve as PHR use cases are discovered and solidified. If you have more ideas about CDS hooks for PHR or want to start a discussion, please [shoot me an email](mailto:cfu288@meremedical.co) and I can edit this post.
