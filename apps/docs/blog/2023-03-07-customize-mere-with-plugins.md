---
slug: exploring-extensibility-with-cds-hooks
title: Personalizing Your Personal Health Record with Plugins
description: A proposal to supercharge your personal health record with third-party CDS hooks
authors:
  name: Christopher Fu
  title: Developer of Mere Medical
  url: https://cfu288.com
  image_url: https://files.meremedical.co/profile.jpg
toc_min_heading_level: 2
toc_max_heading_level: 5
hide_table_of_contents: false
---

Currently, personal health records (PHRs) such as Mere do a great job of syncing and showing you your medical records across different healthcare providers. Mere makes it easy to read and search for your medical records across multiple health systems. Want to compare your last red blood cell count to your previous lab results? Mere will generate a graph for you. Don't remember which vaccines you've already gotten? Mere can group and summarize your entire vaccine history in one view.

PHRs such as Mere are excellent at storing and showing you your medical data. But there's a big difference between just _showing_ you your data and actually _providing insights_ into your data.

The next problem Mere wants to solve is this: how can Mere make your data _actionable_? How can Mere help you learn more about yourself and your conditions? Can Mere recommend actions you can take to improve your health? And can Mere do all this while maintaining its core tenants of privacy, local-first data, and user autonomy?

<!--truncate-->

There are many different ways Mere _could_ provide health insights to users where it currently does not. If you're using Mere to manage medical records for your child, you could track their vaccine immunization history, and Mere could remind you when your next vaccine appointment should be. If you've recently become pregnant, Mere could help remind you when you should see your doctor, which screenings to get, and when. Mere could help you find the lowest prices for your current medications. Given your history, Mere could use AI to make more intelligent predictions or highlight risk factors. Mere could implement many possible features like this - but features that may be helpful for one person may be useless to another. Even if Mere could build every feature, only some people may want to enable such features.

That's why one of the future goals of Mere is to allow for customization through opt-in plugins that users can enable. The long-term goal is to offer a plugin marketplace to allow for third-party developers to publish extensions to Mere so that users and patients can customize their experience.

## Where HL7 comes into play

There are a few ways that Mere can offer this plugin-ability from a technical standpoint. Given Mere's strong basis in HL7 healthcare standards, it makes sense to explore what other HL7 standards exist already that allow for clinical client extensibility in healthcare. There have not been many proposals exploring extensibility in personal health records (PHRs) specifically, but HL7 has established some standards that allow for extensibility in other clinical client applications like electronic medical records (EMRs) that doctors and providers use.

HL7 specifies two significant ways that clinical clients, usually referring to EMRs, can implement extensibility:

- Using [HL7 Clinical Decision Support (CDS) hooks standard](https://cds-hooks.org/). CDS hooks allow third-party developers to create actionable cards displayed directly to providers inside the EMR. These cards augment the providers' experience, providing real-time insights into their data.
- Using [SMART on FHIR applications](https://www.hl7.org/fhir/smart-app-launch/) to embed third-party clinical apps that can be embedded in the EHR and provide completely different experiences currently not possible in the EMR.

In this post, we will dive deeper into how PHRs can adopt CDS hooks to enable extensibility. We're focusing on CDS hooks primarily because it will be an easier standard to adapt for PHRs while still enabling third party apps to extend PHR functionality.

## Overview of CDS Hooks and their Limitations in Personal Health Records

The point of this post isn't to say that Mere has already implemented CDS hook-based plugins today and is ready for third-party plugins, but to lay the groundwork and discuss how the CDS hook standard may need to be updated to handle PHR use cases. The great thing about building off a current standard like CDS hooks is that CDS hooks built for one PHR could be used for any PHR. This following paragraphs might only make sense if you've already read the [HL7 Clinical Decision Support (CDS) hooks standard](https://cds-hooks.org/).

To quickly summarize CDS hooks - they're HTTP web hooks that get called whenever a user of a clinical client, such as a EMR, takes a specific action. Examples of these actions include when a provider opens a patient's chart or when a provider starts a medication order for a patient. The idea is that registered third-party apps can be called whenever one of these actions is triggered and provide real-time feedback to the user about their actions. So, for example, a CDS application that can listen for when a doctor is entering a medication order for a specific drug in the EMR can suggest a different medication via a card in the UI of the EMR:

![CDS hook flow](https://cds-hooks.org/images/overview.png)

The CDS hook standard was primarily built for EMR systems and makes several assumptions:

- There is a single FHIR store from which the third-party CDS hook can fetch the current patients records from
- The hook trigger types are related to a clinical or EMR action.

There are a few reasons why these assumptions cause issues for PHRs:

- PHRs may pull data from multiple sources, not a single FHIR source
- Most of the currenly specified hook types, e.g. the `patient-view` hook, don't really make sense in PHRs as every view is a patient view. Other hooks like `medication-prescribe` and `order-review` are not actions users of a PHR would make.
- PHRs may not expose a FHIR endpoint, especially if they are local-first like Mere is. It is unreasonable to expect client PHRs to implement the entire FHIR server standard.

These assumptions limit the ability of PHRs to use CDS hooks in their current state today.

Another current limitation of the existing spec is that these hooks don't currently self-describe themselves in a machine parsable way, which means a developer needs to implement specific handling for each new hook that gets added instead of having the client automatically provide the relevant data requested by a CDS hook.

### CDS Hooks Technical Details

[If you're already familiar with the CDS hooks technical implementation, feel free to jump to my proposed changes](#what-needs-to-change-with-cds-hooks-to-work-with-personal-health-records).

Lets dig deeper on how CDS hooks work technically.

First, all CDS hooks are exposed via a discovery endpoint. This is metadata that lets a clinical client know which CDS hooks are available to them. It would normally be found on `{baseURL}/cds-services` and would return an array of hook metadata objects. Each object would have the following properties:

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

Now lets dig into a specific hook, which would be called at `{baseURL}/cds-services/{id-from-discovery-url}`

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

#### Updating the `hook` Field to handle PHR use cases

The `hook` field should be expanded to handle use cases commonly found in a PHR. This isn't a technical limitation of the current spec, but as common use cases start to converge from multiple PHR implementations, it may make sense to standardize several of them so that hooks can be transferrable across PHR implementations.

#### Adding a `parameters` Field to the CDS Hook Body

Introduction of a new root property to the hook body called `parameters`. This field would function similarly the pre-existing `prefetch` field, where each key would be a string and each value would be a prefetch template (possibly renamed parameter templates when used in the `parameters` field).

The main difference between the newly introduced parameter templates and prefetch templates is their intent. Prefetch templates are really intended as a "performance hack" to allow the clinical client to provide information to the hook with the intention of speeding up execution, however the output of the hook should be the same even if the prefetch data is not provided. On the other hand, parameter templates would specify mandatory FHIR resources to be provided by the client. These would be mandatory parameters required by the hook to perform its duties. The context template would be a query for FHIR resources on the clinical client.

The reason for introducing a new field for this instead of just adding these new templates to the `context` field once again comes down to intent. Properties in the `context` field are defined and implemented explicitly by a developer, while templates in the `prefetch` field and `parameters` field can be parsed and automatically executed by any clinical client. The only way to know what properties go into a `context` property currently is for a human developer to [go read the hook documentation](https://cds-hooks.org/hooks/template/) and implement those specific properties in that hook. Meanwhile, both the `prefetch` fields and the `parameters` fields are defined in the discovery endpoint and can be handled automatically by the clinical client. This is more extensible and requires less manual development work for each newly defined CDS hook.

An example of how this might look is shown below:

**Discovery Endpoint**

```json
{
  "services": [
    {
      "hook": "patient-view",
      "title": "Static CDS Service Example",
      "description": "An example of a CDS Service that returns a static set of cards",
      "id": "static-patient-greeter",
      "parameters": {
        "patientToGreet": "Patient/{{context.patientId}}"
      }
    },
    ...
  ]
}
```

**CDS Hook Body**

```json
{
  "hookInstance": "d1577c69-dfbe-44ad-ba6d-3e05e953b2ea",
  "hook": "patient-view",
  "fhirServer": "http://hooks.smarthealthit.org:9080",
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
  "parameters": {
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

#### Updating the Hook Body to Handle Multiple FHIR Servers as Sources

The `fhirServer` and `fhirAuthorization` fields currently allow a hook to define a single FHIR server. Unless a PHR has also implemented their own FHIR server for external api's to fetch, it is unlikely that this is a practical use case for PHRs. Most PHRs that want to share FHIR resources with a hook would likely want to do one of two things:

1.  Send a list of `fhirServer`/`fhirAuthorization` tuples that the PHR itself uses so that the hook can pull the resources from the FHIR servers itself or
2.  Send over just the required FHIR resources needed for the hook to execute as a property the `context` field of the hook with zero `fhirServer`/`fhirAuthorization` tuples.

One way to do this (while maintaining backward compatibility with existing hooks) would be to allow for a `fhirSources` array, where each array element contains a `fhirServer` element, a `fhirAuthorization` element.

So to summarize, in a CDS hook that does not require any external `fhirServer` to fetch data from, the properties `fhirServer`, `fhirAuthorization`, and `fhirSources` should be null or undefined. In a hook that requires exactly one external FHIR server, both the `fhirServer` and `fhirAuthorization` properties should be provided. In cases where the hook may expect more than one external FHIR server, the `fhirSources` array should be populated and both `fhirServer` and `fhirAuthorization` should be null or undefined.

The `context` property would need to be updates as well. The `context` property technically can contain any data, but currently most hooks usually provide a `userId`, `patientId`, and `encounterId` as fields. These are variables that are primarily intended to be passed to the hook as "parameters" but can also be parameters used within the prefetch templates (as well as our newly defined parameter templates). However, these three properties are usually specific to a single FHIR server. If we want to pass multiple `fhirServers` as specified above, each will now require their own context to reference, especially when referring to prefetch templates or parameter templates.

To solve this problem in a backwards compatible way, we would introduce a new `contexts` root property that would act similarly to the current `context` property, however the `contexts` object would contain key:value properties where the key would be the value of the `fhirServer` to apply the context to and the value would be a context values specific to the `fhirServer` specified.

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
      "parameters": {
        "patientsToGreet": "Patient/{{contexts.patientId}}"
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
    "patientsToGreet": [
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
```

Note that there are still some problems that need to be solved with this approach, like how a PHR will get access tokens to their sources that have a different scope provided to the PHR app itself (e.g. the PHR may have read access to all resource types but may only want to provide an access token to a hook with read access to AlleryIntolerance resources).

#### Make the Discovery Endpoint Expose what Properties are Expected in the Context Object

The `context` field should be added to the CDS discovery endpoint, and should define which properties are expected from the clinical client. By doing this we make parsing the required fields for a hook machine parsable and generalizable, clinical clients can decide themselves whether or not they can provide the information needed to the hook automatically without an external developer needing to add explicit support for the hook. Each element in the `context` field of the discovery endpoint would be a key:value pair, where the key was the name of the context item, and the value was a [CodableConcept](https://build.fhir.org/datatypes.html#CodeableConcept) representing the data type to be populated by the clinical client. See below for an example.

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
      "parameters": {
        "patientsToGreet": "Patient/{{contexts.patientId}}"
      }
    }
  ]
}
```

## To Be Continued?

This post is still a work in progress and will likely evolve as PHR use cases are discovered and solidified. If you have more ideas about CDS hooks for PHR or want to start a discussion, please [shoot me an email](mailto:cfu288@meremedical.co) and I can edit this post.
