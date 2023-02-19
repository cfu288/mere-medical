#!/bin/sh
jq \
'
[
    .entry[] | { id: .resource.id, name: .resource.name, url: .resource.address }
] | 
. += [
    {
        "id": "sandbox",
        "name": "Sandbox",
        "url": "https://fhir.epic.com/interconnect-fhir-oauth",
    }
]' \
< RawDSTU2Endpoints.json > DSTU2Endpoints.json