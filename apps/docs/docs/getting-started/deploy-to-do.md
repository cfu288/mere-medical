---
sidebar_position: 2
description: Deploy Mari Medical to Digital Ocean with one click
---

# 1-Click Deploy to Digital Ocean

To deploy Mari Medical to Digital Ocean App Platform, click the button below and follow the steps:

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/cfu288/mari-medical/tree/main)

To set up OnPatient integration, you'll need to provide the values for the environmental variables `ONPATIENT_CLIENT_ID` and `ONPATIENT_CLIENT_SECRET`. After deploying, you'll also need to set up a redirect uri back to your app in the OnPatient portal. Note that you'll need to deploy the app to digital ocean first in order to _get_ your redirect uri, which should look something like `https://mari-medical-<random_string>.ondigitalocean.app/api/v1/onpatient/callback`. Go to [this guide](./onpatient-setup) to see how to get those values and learn more. If you don't need OnPatient integration, feel free to leave those variables blank.
