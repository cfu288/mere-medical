---
slug: whats-new-this-year-2024
title: What's New with Mere This Year
description: A lot has changed behind the scenes
authors:
  name: Christopher Fu
  title: Developer of Mere Medical
  url: https://cfu288.com
  image_url: https://files.meremedical.co/profile.jpg
toc_min_heading_level: 2
toc_max_heading_level: 5
hide_table_of_contents: false
---

# It's Been a While

A quick update on my life: I'm now in my fourth year of medical school, in the midst of applying for residencies in Internal Medicine I've still been working on Mere in the small pockets of time I find in between rotations and studying for board exams. Its incredible how much progress can be made by small and consistent updates over a long period of time. I'm excited to share the latest developments that have been brewing behind the scenes.

<!--truncate-->

## Things we've accomplished in 2023:

## Features

- Integrated multiple new data sources, including AllScripts/Veradigm, Cerner, and preliminary support for the VA.
- Transitioned from PouchDB to Dexie for the underlying database.
- Implemented an option to store records in LokiJS, featuring a custom encryption adapter for password-protected storage.
- Introduced graphing for historical lab results, complete with sparklines for visual representation.
- Enhanced the search functionality and filtering capabilities within the timeline.
- Developed a feature to detect and visually highlight abnormal lab results.
- Executed numerous user interface enhancements and refinements.
- Expanded privacy settings to offer more granular control.
- Refined the connection synchronization process to better manage failures and streamline re-authentication.
- Integrated CCDA parsing and enriched the presentation of CCDA data within the user interface.

## Infrastructure

- Implemented error reporting to facilitate bug detection (available on an opt-in basis).
- Transitioned our continuous integration and deployment (CI/CD) processes to GitHub Actions, moving away from a self-hosted Drone CI setup.
- Adopted Calendar Versioning (CalVer) versioning system.
- Finally added several end-to-end tests and preliminary smoke tests.
- Began incorporating unit tests (but definitely need more).

## Documentation

- Enhanced the documentation for self-hosting Mere, making it more user-friendly.
- Supplemented our documentation with detailed guides on establishing connections to various Electronic Health Records (EHR) systems.
