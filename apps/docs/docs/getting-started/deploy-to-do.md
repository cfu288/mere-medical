---
sidebar_position: 2
description: Deploy Mari Medical to Digital Ocean with one click
---

# 1-Click Deploy to Digital Ocean

If you don't want to deploy Mari Medical to your own server or local machine, you can easily deploy Mari Medical to Digital Ocean App Platform with one click!. Just click the button below and follow the steps to deploy Mari Medical for $5 a month. The button below is a referral link that comes with $200 worth of credit for the first two months.

Note that by default, DO App platform pre-selects their $12 droplet. You can downgrade to the $5 droplet during setup by clicking `Edit Plan`.

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue-ghost.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/cfu288/mari-medical/tree/main&refcode=f6e0d718edc7)

To set up OnPatient integration, you'll need to provide the values for the environmental variables `ONPATIENT_CLIENT_ID` and `ONPATIENT_CLIENT_SECRET`.

After deploying, you'll also need to set up a redirect uri back to your app in the OnPatient portal. Note that you'll need to deploy the app to digital ocean first in order to _get_ your redirect uri, which should look something like `https://mari-medical-<random_string>.ondigitalocean.app/api/v1/onpatient/callback`.

Go to [this guide](./onpatient-setup) to see how to get those values and learn more. If you don't need OnPatient integration, feel free to leave those variables blank.
