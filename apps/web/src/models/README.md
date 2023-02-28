# Models

A place to store data transfer objects, schemas, and related typings to RxDB tables or other data related objects.

## Connection Document

These are documents related to storing metadata on connections to external sources. They usually contain information about access tokens, refresh tokens, the url's needed for fetching data and authenticating.

## Clinical Document

These are documents that store clinical data about a person. They're essentially a wrapper around FHIR data or XML documents most of the time with associated metadata to make parsing the data later easier.

## User Document

These are documents that store data about the current user

## User Preferences

These are documents that store settings and customizable user preferences for a user.
