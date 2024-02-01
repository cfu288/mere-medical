---
slug: what-is-mere-medical
title: What is Mere Medical?
authors: [cfu288]
---

About a year ago, I was a second-year medical student preparing to start my third-year clinical rotations. It was a pretty exciting but terrifying time - I was also getting ready to take my first set of board exams. On top of long days of studying, I had to complete a lot of paperwork required by the school and the hospitals I would be rotating at. One of the biggest things I needed to get done before starting my rotations was ensuring I was up to date on my vaccinations and had my latest health records.

I quickly realized that getting all my old vaccine records was more difficult than I originally expected. Most of my previous vaccination records were with my old primary care physician (PCP) in my hometown, not with my current one. Luckily, my old PCP offered a patient portal I could use to see my old records. After a quick phone call to my old PCP's office to set up my online account, I could log in and see my old vaccine records. However, my current PCP used a completely different patient portal. So if I wanted to see my most recent blood work and my historical vaccine data at the same time, I needed to log in to two places at once.

A few months later, I moved to a new apartment closer to my new rotation site and had to again find another new PCP closer to me. Luckily, this new PCP I chose used the patient portal system that my original PCP did. However, despite using the same EMR, I was forced to create a new login for this portal as this new doctor was part of a different health system from my original PCP. I now had a total of three different logins to see my health data.

Throughout this process, I kept thinking: why was getting all my medical records in one place so tricky? There had to be an easier way.

<!--truncate-->

## Looking for an existing solution

I searched for other services and apps that would automatically sync to multiple patient portals and aggregate my records. I thought to myself that there was no way I was the first one to have this problem.

In my search for an app to do this for me, I found one or two decent-looking options, but the main issue I had with them was that they were external third party companies not directly associated to my health care providers. While many of them looked reputable, I was antsy about sending over my medical information to a third party. What if this company had a data leak? What if they sold their product to another cooperation? What would happen to my data then?

At this point, I decided it was time to build something myself to solve my problems. I had a few goals in mind for a solution that other solutions didn't solve or seem to prioritize:

- Cross-platform: I should be able to access my records on any device
- Offline-first: I should be able to access my medical records anytime, even without an internet connection. I wanted to ensure I could access my records whenever needed, especially at doctor's offices with bad wifi-connections or even when riding public transit.
- Privacy focused: I shouldn't have to trust a third party to manage my records. Ideally, I could download a program or host the software on my machines.
- Respect user preferences: Features should always be opt-in, and the user should always control their data.

## Why now?

It's a good time to be building a project like this. As of December 31st 2022 (or 7 days ago since this article was written), as part of the 21st Century Cures Act, [certified electronic medical record systems are now required to provide open FHIR API endpoints to their customers and patients](https://www.healthit.gov/buzz-blog/healthit-certification/an-upcoming-milestone-in-our-interoperability-journey). FHIR is a HL7 standard that defines data primitives in healthcare and allows medical systems to communicate using these data primitives. In short, FHIR defines a standardized way for external programs to communicate with these health systems to access patient data.

This means that application developers can now write programs to integrate with these electronic medical record systems and patient portals in a relatively standard way across different systems, making it easier to develop applications that work with health data.

## Where are we now?

Mere Medical is still in early development and is essentially pre-release software. However, we've already accomplished a lot of goals:

- Self-hostable - Run Mere Medical on your computers, no third parties
- Open source - Audit every line of code that touches your medical records.
- Multi-platform - A progressive web application that runs on any OS or device with a browser.
- Offline-first - Data is stored locally on device and can be accessed with no internet connection.
- Full control of data - Backup, export, and delete your data.
- Automatic sync to patient portals - Reduce the work you need to do to get your records.
- Multiple EMR support - Integrations to two different EMR systems, which includes 1000+ health systems and practices.

There are a few more features I'd like to wrap up before we hit v1.0, hopefully coming soon.

## Demo

You can see the live demo at [demo.meremedical.co](https://demo.meremedical.co)

Mere provides a quick timeline view so you can navigate and see all of your records as a series of cards in chronological order. You can click on some cards to see more information.
<video controls width="100%">

  <source src="/vid/timeline.webm" type="video/webm"/>
</video>
<br/>
<br/>

Clicking on the summary tab will give you an overview about your health.
<video controls width="100%">

  <source src="/vid/search.webm" type="video/webm"/>
</video>
<br/>
<br/>

You can use the search bar to find specific records.
Clicking on cards with lab results will show you the results of that card as well as any previous lab values for that lab. When possible, Mere will graph your results so you can see how the value has changed over time.
<video controls width="100%">

  <source src="/vid/see-labs.webm" type="video/webm"/>
</video>
<br/>
<br/>

You can already log in with major health providers like Epic MyChart.
<video controls width="100%">

  <source src="/vid/add-connection.webm" type="video/webm"/>
</video>
<br/>
<br/>

Mere supports connecting to multiple sources all at once
<video controls width="100%">

  <source src="/vid/multiple-connections.webm" type="video/webm"/>
</video>
<br/>
<br/>

Your data is yours - you can back up and export your data to JSON at any point.
<video controls width="100%">

  <source src="/vid/settings-and-export.webm" type="video/webm"/>
</video>
<br/>
<br/>
