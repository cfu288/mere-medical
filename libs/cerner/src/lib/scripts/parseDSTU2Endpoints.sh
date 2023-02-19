#!/bin/sh
jq \
'
[
    .entry[] | { id: .resource.id, name: .resource.contained[0].name, url: .resource.address }
] | 
. += [
    {
        "id": "sandbox",
        "name": "Sandbox",
        "url": "https://fhir-myrecord.cerner.com/dstu2/ec2458f2-1e24-41c8-b71b-0e701af7583d/",
    }
]' \
< RawDSTU2Endpoints.json > DSTU2Endpoints.json
