---
slug: exploring-extensibility-with-cds-hooks
title: Personalizing Your Personal Health Record with Plugins
description: A proposal to supercharge your personal health record with third-party CDS hooks
authors: [cfu288]
---

Personal health records (PHRs) such as Mere do a great job of syncing and showing you your medical records across different healthcare providers. Mere makes it easy to read and search for your medical records across multiple health systems. Want to compare your last red blood cell count to your previous lab results? Mere will generate a graph for you. Need help remembering which vaccines you've already gotten? Mere can group and summarize your entire vaccine history in one view.

PHRs such as Mere are excellent at storing and showing you your medical data. But there's a big difference between just _showing_ you your data and actually _providing insights_ into your data.

The next problem Mere wants to solve is this: how can Mere make your data _actionable_? How can Mere help you learn more about yourself and your conditions? Can Mere recommend actions you can take to improve your health? And can Mere do all this while maintaining its core tenants of privacy, local-first data, and user autonomy?

<!--truncate-->

There are many ways Mere _could_ provide health insights to users where it currently does not. For example, if you're using Mere to manage medical records for your child, you could track their vaccine immunization history, and Mere could remind you when your next vaccine appointment should be. If you've recently become pregnant, Mere could help remind you when to see your doctor, which screenings to get, and when. Mere could help you find the lowest prices for your current medications. Given your history, Mere could use AI to make more intelligent predictions or highlight risk factors. Mere could implement many possible features like this - but features that may be helpful for one person may be useless to another. Even if Mere could build every feature, only some people may want to enable such features.

That's why one of the future goals of Mere is to allow for customization through opt-in plugins that users can enable. In addition, the long-term goal is to offer a plugin marketplace to allow third-party developers to publish extensions to Mere so that users and patients can customize their experience.

## Where HL7 comes into play

There are a few ways that Mere can offer this plugin-ability from a technical standpoint. First, given Mere's strong basis in HL7 healthcare standards, it makes sense to explore what other HL7 standards exist already that allow for clinical client extensibility in healthcare. While there have not been many proposals exploring extensibility in personal health records (PHRs), HL7 has established some standards that allow for extensibility in other clinical client applications like electronic medical records (EMRs) that doctors and providers use.

HL7 specifies two significant ways that clinical clients such as EMRs can implement extensibility:

- Using [HL7 Clinical Decision Support (CDS) hooks standard](https://cds-hooks.org/). CDS hooks allow third-party developers to create actionable cards displayed directly to providers inside the EMR. These cards augment the providers' experience, providing real-time insights into their data. If you're a developer, you can think of these just as standard web hooks your app can listen and react to when a user takes a specific action.
- Using [SMART on FHIR applications](https://www.hl7.org/fhir/smart-app-launch/) to embed third-party clinical apps that can be embedded in the EHR and provide completely different experiences currently not possible in the EMR. SMART on FHIR is a more complex standard that allows for third-party developers to either embed their own apps inside a clinical client or call the data endpoints exposed by the EHR.

While these standards are built with EHRs as the target clinical clients, there's no reason why these standards could not be implemented in PHRs as well (with some modifications). It would be amazing if PHRs, which are usually SMART on FHIR applications themselves, could further host third-party SMART on FHIR apps. It would be SMART on FHIR apps all the way down!

Unfortunately, implementing the SMART ON FHIR standard is non-trivial and likely out-of-scope for most PHR implementations. However, PHRs could adapt the CDS hook standard (despite being a less-mature standard) - primarily due to its lower complexity to implement for both third-party developers and PHR developers.

So, what would it take to adopt CDS hooks in personal health records? This post is already getting a little long, so we'll jump into more details in [Part 2](/blog/exploring-extensibility-with-cds-hooks-part-2).
