---
slug: exploring-customization-with-cds-hooks
title: Customize Mere with plugins
description: Supercharge your personal health records with third-party CDS hooks
authors:
  name: Christopher Fu
  title: Developer of Mere Medical
  url: https://cfu288.com
  image_url: https://files.mari.casa/profile.jpg
---

# Why Mere Medical

So, at the moment, Mere does a great job of syncing and showing you your medical records across different health care providers. Mere makes it easy to read and search for your medical records across multiple health systems. Want to see what your last red blood cell count was? Mere can show you. Want to see how your last red blood cell count compared to previous lab results? Mere will generate a graph for you. Don't remember which vaccines you've already gotten?

Mere is great at storing and showing you your data. But theres a big difference between just owning your data and knowing how to interpret your data or what actions to take next.

The next problem Mere wants to solve is this: how can Mere make your data _actionable_? How can Mere help you learn more about yourself and your conditions. Can Mere recommend next steps for you?

There are so many ways Mere could theoretically provide insights. If you're using Mere to manage medical records for your child, you could track their vaccine immunization history and Mere could remind you when your next doctor's visit should be. If you've recently become pregnant, Mere could help remind you when you should see your doctor and which screenings tests to get and when. Mere could help you find the cheapest prices for your current medications. Mere could potentially use AI to make smarter predictions or highlight risk factors given your history. Realistically, not all of these could be built into the main app - medicine is extremely broad and features that may be helpful for one person would be useless to another. Even if we could, not everyone wants their data to be used in such ways and may decide to use none of these "extra features".

That's why the goal is to allow for customization of Mere through plugins that users can enable and by offering a plugin marketplace for third party developers to submit their plugins.

# Where HL7 comes back into play

This type of plugin architecture is not completely novel in healthcare. Electronic medical records (EHRs) actually implement "plugin" apps and cards that augment the experience doctors have when using their EHR. These plugins
