#!/bin/sh
jq \
'
[
    .entry[] | { id: .resource.contained[0].id, name: .resource.contained[0].name, url: .resource.address }
] | 
. += [
    {
        "id": "sandbox_veradigm",
        "name": "Veradigm Sandbox",
        "url": "https://fhir.fhirpoint.open.allscripts.com/fhirroute/open/CustProProdSand201SMART/",
    }
] | 
. += [
    {
        "id": "sandbox_touchworks",
        "name": "TouchWorks Sandbox",
        "url": "https://tw181unityfhir.open.allscripts.com/OPEN/",
    }
]
' \
< RawDSTU2Endpoints.json > parsedDSTU2Endpoints.json
