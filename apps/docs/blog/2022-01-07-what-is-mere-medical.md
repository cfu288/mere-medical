---
slug: what-is-mere-medical
title: What is Mere Medical?
authors:
  name: Christopher Fu
  title: Developer of Mere Medical
  url: https://cfu288.com
  image_url: https://files.mari.casa/profile.jpg
# tags: [hola, docusaurus]
---

# Why Mere Medical

About a year ago, I was a second-year medical student preparing to start my third-year clinical rotations. It was a pretty exciting but terrifying time - I was also getting ready to take my first set of board exams. On top of long days of studying, I had to complete a lot of paperwork required by the school and the hospitals I would be rotating at. One of the biggest things I needed to get done before starting my rotations was ensuring I was up to date on my vaccinations and had my latest health records.

I quickly realized that getting all my old vaccine records was more difficult than I originally expected. Most of my previous vaccination records were with my old primary care physician (PCP) in my hometown, not with my current one. Luckily, my old PCP offered a patient portal I could use to see my old records. After a quick phone call to my old PCP's office to set up my online account, I could log in and see my old vaccine records. However, my current PCP used a completely different electronic medical record (EMR) system and had a different patient portal. So if I wanted to see my most recent blood work and my historical vaccine data at the same time, I needed to log in to two places at once.

A few months later, I moved to a new apartment closer to my new rotation site and had to again find another new PCP closer to me. Luckily, this new PCP I chose used the same EMR and patient portal system that my original PCP did. Unluckily, I had to go through the patient portal creation process all over again. Despite using the same EMR, this new doctor was part of a different health system as my original PCP, which meant a new account still. Ultimately I had two different logins, and I had trouble manually linking the accounts after the fact.

Throughout this process, I kept thinking: why was getting all my medical records in one place so tricky? There had to be an easier way.

# Looking for an existing solution

I searched for other services and apps that would automatically sync to multiple patient portals and aggregate my records. I thought to myself that there was no way I was the first one to have this problem.

In my search for an app to do this for me, I found one or two decent-looking options, but the main issue I had with them was that they were external third party companies not directly associated to my health care providers. While many of them looked reputable, I was antsy about sending over my medical information to a third party. What if this company had a data leak? What if they sold their product to another cooperation? What would happen to my data then?

At this point, I decided it was time to build something myself to solve my problems. I had a few goals in mind for a solution that other solutions didn't solve or seem to prioritize:

- Cross-platform: I should be able to access my records on any device
- Offline-first: I should be able to access my medical records anytime, even without an internet connection. So I wanted to ensure I could access my records whenever needed, especially at doctor's offices with bad wifi-connections or even when riding public transit.
- Privacy focused: I shouldn't have to trust a third party to manage my records. Ideally, I could download a program or host the software on my machines.
- Respect user preferences: Features should always be opt-in, and the user should always control their data.

# Why now?

It's a good time to be building a project like this. As of December 31st 2022 (or 7 days ago since this article was written), as part of the 21st Century Cures Act, [certified electronic medical record systems are now required to provide open FHIR API endpoints to their customers and patients](https://www.healthit.gov/buzz-blog/healthit-certification/an-upcoming-milestone-in-our-interoperability-journey). FHIR is a HL7 standard that defines data primitives in healthcare and allows medical systems to communicate using these data primitives. In short, FHIR defines a standardized way for external programs to communicate with these health systems to access patient data.

This means that application developers can now write programs to integrate with these electronic medical record systems and patient portals in a relatively standard way across different systems, making it easier to develop applications that work with health data.

# Where are we now?

Mere Medical is still in early development and is essentially pre-release software. However, we've already accomplished a lot of goals:

- Self-hostable - Run Mere Medical on your computers, no third parties
- Source-available - Audit every line of code that touches your medical records.
- Multi-platform - A progressive web application that runs on any OS or device with a browser.
- Offline-first - Data is stored locally on device and can be accessed with no internet connection.
- Full control of data - Backup, export, and delete your data.
- Automatic sync to patient portals - Reduce the work you need to do to get your records.
- Multiple EMR support - Integrations to two different EMR systems, which includes 450+ health systems and practices.

There are a few more features I'd like to wrap up before we hit v1.0, hopefully coming soon.

# Demo

Video walkthrough coming soon as I am still wrapping up some features. In the meantime, you can see the live demo at [app.meremedical.co](https://app.meremedical.co).
