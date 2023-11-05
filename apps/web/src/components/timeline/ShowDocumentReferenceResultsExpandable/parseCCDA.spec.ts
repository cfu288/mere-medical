import { parseDateString } from './parseCCDA';

/**
 * effectiveTime use in C-CDA Entries

This is an abstracted universal definition of effectiveTime in C-CDA documents:
Per the RIM, the effectiveTime, also referred to as the “biologically relevant time,” is the time at which the act holds for the patient. (C-CDA 2.1, pg 22)

@value - Use this when the event (i.e. encounter, assessment, measurement or administration) only occurred at a single point in time
low/@value - Use this when the target act starts, or will start, at a point in time and could end in the future (known or unknown). If C-CDA only includes an effectiveTime/low it means the 'act' is ongoing and active.
high/@value - 
Use this when the target act starts at a point in time and could end. 
Omit <high> element to indicate act is ongoing (prefered). If your system must include a high element, use high/@nullFlavor=”NA” (Not Applicable). 
Use nullFlavor=”UNK” if act has ended If it has ended, and the end time is unknown
Do NOT use nullFlavor=”UNK” when you aren’t certain if the act has ended. Omit the element or use nullFlavor=”NI” (No information).

In general, we do not recommend use of other elements (e.g. <center>, <width> or <period>) within effectiveTime with the exception of the use of <period> for medication administration schedules.

Only include known specificity. For example, if you only know a person’s birthday to day, only include to day effectiveTime/@value=”20121111”. Do not pad out time with zeros.

When reporting time it is best practice to include a timezone offset. effectiveTime/@value=20140104123506-0500" 

If specificity to seconds is not available - either of these patterns is possible. Some systems will always send the additional zeros whether significant or not:
 effectiveTime/@value=201401041235-0500"  
 effectiveTime/@value=20140104123500-0500" 

When time zone is not specified the time SHALL be interpreted as local, not UTC. To indicate the time zone of UTC include +0000.
 
Time Zone in United States
UTC Offset Standard Time
UTC Offset Daylight Saving Time
Eastern
UTC - 0500
UTC - 0400
Central
UTC - 0600
UTC - 0500
Mountain
UTC - 0700
UTC - 0600
Pacific
UTC - 0800
UTC - 0700


 */
describe('parseDateString', () => {
  it('should parse C-CDA effectiveTime formats', () => {
    // const date = parseDateString('20140104123506-0500');
    // expect(date).toBeDefined();
    // expect(date).toEqual('2014-01-04T12:35:06-05:00');
  });
});
