#!/bin/sh
jq '[.entry[] | { id: .resource.id, name: .resource.name, url: .resource.address }] | .[].url |= sub("/api/FHIR/DSTU2/"; "") ' < RawDSTU2Endpoints.json > DSTU2Endpoints.json