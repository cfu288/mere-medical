# reference-pipeline

Builds the reference library the chat agent reads. The pipeline fetches
published clinical guidance and FDA drug labels from configured sources,
splits them into the sections their authors wrote, and stores them in a SQLite
file the API serves.

## Schema

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  edition TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT NOT NULL
);
CREATE TABLE sections (
  document_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  parent_id TEXT,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  content_md TEXT NOT NULL,
  url TEXT,
  PRIMARY KEY (document_id, section_id)
);
CREATE VIRTUAL TABLE documents_fts USING fts5(id UNINDEXED, title, summary, tokenize = 'porter unicode61');
CREATE VIRTUAL TABLE sections_fts USING fts5(document_id UNINDEXED, section_id UNINDEXED, title, content_md, tokenize = 'porter unicode61');
```

A **reference** (`documents`) is a catalog entry for one published work, such
as a guideline, a USPSTF recommendation page or a CDC schedule, or, for a drug,
the FDA labels chosen for its generic name. It carries the title, edition,
summary and url a citation names.

A **section** (`sections`) is the text under one heading of a reference,
nested as the headings nest and numbered in reading order. The pipeline also
makes sections of its own for the text before the first heading ("Opening
text"), for each page of a PDF section too long to read at once, and for each
route a drug is sold in, which holds that route's label.

The agent uses the two tables at different moments. It chooses a reference by
searching titles and summaries, then reads one section at a time. A guideline
is far too long to read whole, and searching the text of every section of
every reference would let one long guideline drown out a one-page CDC topic.
A citation needs both rows, the reference's title and url and the section's
page or own url. Section ids repeat across references (every drug label has a
"2 DOSAGE AND ADMINISTRATION"), so a section is always addressed as reference
plus section id. The two `_fts` tables are the full-text indexes behind the
two searches.

Example rows. The VA-DoD hypertension guideline:

| id                  | title                         | edition | summary                                                                                                                | url                                                                                                        |
| ------------------- | ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| va-dod-hypertension | VA-DoD Hypertension Guideline | 2026    | High blood pressure in adults: diagnosis, home and office measurement, blood pressure goals, and choice of medications | https://www.healthquality.va.gov/HEALTHQUALITY/guidelines/CD/htn/HTN-CPG_2026-Guideline_final_20260827.pdf |

| section_id                                                   | parent_id                                                    | position | title                                                                | page_start | page_end | url  | content_md                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------ | -------- | -------------------------------------------------------------------- | ---------- | -------- | ---- | ---------------------------------------------------------------- |
| ix-recommendations                                           | va-dod-clinical-practice-guideline-for-diagnosis-and-managem | 30       | IX. Recommendations                                                  | 26         | 28       | null | "The evidence-based clinical practice recommendations listed..." |
| b-treatment-goals-and-general-approaches-to-hypertension-man | ix-recommendations                                           | 37       | B. Treatment Goals and General Approaches to Hypertension Management | 33         | 33       | null | empty; its text is split by page below                           |
| page-34                                                      | b-treatment-goals-and-general-approaches-to-hypertension-man | 39       | Page 34                                                              | 34         | 34       | null | "cardiovascular causes.(80,81) An additional SR by Matsumoto..." |

The estradiol labels, one top-level section per route:

| id              | title                     | edition | summary                                                           | url                                                                            |
| --------------- | ------------------------- | ------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| label-estradiol | FDA drug label: Estradiol | 2026    | Estradiol (brands: Alora, Climara, Delestrogen, ...); Estrogen... | https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=estradiol |

| section_id                              | parent_id   | position | title                       | page_start | page_end | url                                                                                                              | content_md                                                             |
| --------------------------------------- | ----------- | -------- | --------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| transdermal                             | null        | 103      | Transdermal: Minivelle      | null       | null     | https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=6c5c47ab-28ee-11e1-bfc2-0800200c9a66&type=display | Label NDA203752 by Noven Therapeutics, LLC, effective 2026-07-31.      |
| transdermal-2-dosage-and-administration | transdermal | 119      | 2 DOSAGE AND ADMINISTRATION | null       | null     | (the same DailyMed url)                                                                                          | "Generally, when estrogen is prescribed for a postmenopausal woman..." |

`parent_id` names a `section_id` in the same reference. A PDF section cites its
pages and has no url; a label section cites its route's DailyMed page and has
no pages.

## How the agent reads it

The agent's tools live in the web app
(`apps/web/src/features/patient-context/agent/referenceTools.ts`) and call the
API's `/api/v1/agent/references` routes (`apps/api/src/app/reference`), which
read this file. The outputs below are real tool outputs, cut where marked.

A guideline question, "Is my blood pressure where it should be?", once the
record tools have given the patient's conditions and readings:

1. `search_references({"query": ["high blood pressure", "hypertension", "BP"]})`
   ranks references by their titles and summaries, a page at a time with the
   total:

   ```
   va-dod-hypertension | VA-DoD Hypertension Guideline | 2026 | High blood pressure in adults: diagnosis, home and office measurement, blood pressure goals, and choice of medications
   cdc-undiagnosed-hypertension | CDC: Undiagnosed Hypertension | 2023 | Undiagnosed Hypertension
   [rows cut]
   Showing 1-18 of 18 references. Call get_outline with a reference id to see its sections.
   ```

2. `get_outline({"reference": "va-dod-hypertension", "section": "ix-recommendations"})`
   lists two levels under a section (or under the reference when no section
   is given), each with the id the next call takes, its size and its place in
   the source:

   ```
   VA-DoD Hypertension Guideline (2026)
   ix-recommendations | IX. Recommendations | 6424 chars | pp. 26-28 | has its own text: read_section to read it
     a-diagnosis-and-monitoring | A. Diagnosis and Monitoring | 0 chars | p. 29
       page-29 | Page 29 | 3054 chars | p. 29
   [rows cut]
     b-treatment-goals-and-general-approaches-to-hypertension-man | B. Treatment Goals and General Approaches to Hypertension Management | 0 chars | p. 33
       page-33-2 | Page 33 | 925 chars | p. 33
       page-34 | Page 34 | 3744 chars | p. 34
   [rows cut]
   ```

3. `read_section({"reference": "va-dod-hypertension", "section": "page-34"})`
   returns the section's own text under its citation, then the ids of its
   subsections when it has any:

   ```
   VA-DoD Hypertension Guideline (2026) > Page 34, p. 34
   https://www.healthquality.va.gov/HEALTHQUALITY/guidelines/CD/htn/HTN-CPG_2026-Guideline_final_20260827.pdf

   cardiovascular causes.(80,81) An additional SR by Matsumoto et al. (2025) found no significant difference [text cut]
   ```

4. `find_in_reference({"reference": "va-dod-hypertension", "query": ["systolic goal", "<130", "blood pressure goal"]})`
   is the fallback when titles are not enough. It lists matching sections in
   document order with a match count and an excerpt, and says how many it
   left out:

   ```
   [rows cut]
   page-33-2 | Page 33 | 11 matches | …Blood Pressure Goals Recommendation 4. For individuals with hypertension, we recomme
   page-34 | Page 34 | 16 matches | …from one SR including 12 RCTs that intensive systolic blood pressure control (SBP goal
   [rows cut]
   [12 more omitted; narrow the terms]
   ```

A drug question, "How do I use my estradiol patch?":

1. `search_references({"query": ["estradiol", "estrogen patch"]})` finds the
   drug's one reference:

   ```
   label-estradiol | FDA drug label: Estradiol | 2026 | Estradiol (brands: Alora, Climara, Delestrogen, [summary cut]
   Showing 1-1 of 1 references. Call get_outline with a reference id to see its sections.
   ```

2. `get_outline({"reference": "label-estradiol"})` shows the routes as the top
   level:

   ```
   FDA drug label: Estradiol (2026)
   oral | Oral: Estradiol | 56 chars
   topical | Topical: Estradiol | 66 chars
   transdermal | Transdermal: Minivelle | 65 chars
   vaginal | Vaginal: Estring | 76 chars
   [subsections cut]
   ```

3. `get_outline({"reference": "label-estradiol", "section": "transdermal"})`
   expands the patch label. Its section ids carry the route as a prefix, so
   the same heading in another route's label is a different id:

   ```
   transdermal | Transdermal: Minivelle | 65 chars | has its own text: read_section to read it
   [rows cut]
     transdermal-2-dosage-and-administration | 2 DOSAGE AND ADMINISTRATION | 742 chars
       transdermal-2-1-treatment-of-moderate-to-severe-vasomotor-symptoms-due-t | 2.1 Treatment of Moderate to Severe Vasomotor Symptoms due to Menopause | 201 chars
   [rows cut]
   ```

4. `read_section({"reference": "label-estradiol", "section": "transdermal-2-dosage-and-administration"})`
   cites the route's own DailyMed page. Reading the route section itself
   (`"section": "transdermal"`) gives the label's application number,
   manufacturer and effective date:

   ```
   FDA drug label: Estradiol (2026) > 2 DOSAGE AND ADMINISTRATION
   https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=6c5c47ab-28ee-11e1-bfc2-0800200c9a66&type=display

   Generally, when estrogen is prescribed for a postmenopausal woman with a uterus, consider addition of a progestogen [text cut]

   Subsections: transdermal-2-1-treatment-of-moderate-to-severe-vasomotor-symptoms-due-t (2.1 Treatment of Moderate to Severe Vasomotor Symptoms due to Menopause, 201 chars); transdermal-2-3-application-instructions (2.3 Application Instructions, 1172 chars)
   ```

Every response is bounded by its unit (a page of catalog rows, two outline
levels, one section, a list of pointers), never by cutting text at a character
budget. A paged response states its total and a cut list says how many rows
it left out.

## Pipeline

```
fetch -> adapter (html | pdf) -> blocks (headings + text) -> sections -> SQLite
```

Each format has its own adapter that produces the same blocks (headings and
text). Building sections from them is shared, with page handling added for
PDFs.

- **HTML**: turndown converts the page to markdown and `#` headings become
  heading blocks. When the page has exactly one `<main>` element (or, failing
  that, exactly one `<article>`), only that element is converted, which leaves
  out site navigation and footers.
- **CDC media**: CDC's content syndication API serves a page's content without
  site navigation. The media's metadata gives the cdc.gov page it syndicates,
  which becomes the reference url every read cites; the content then goes
  through the HTML adapter. CDC's own attribution block stays in the text.
  Prefer this over CDC PDFs.
- **Drug labels**: the config names a generic drug. Ingest stores one
  reference per generic, which the agent finds first. Each route the drug is
  sold in, such as oral or transdermal, has a section holding that route's
  full label as its subsections and citing its own DailyMed page. For each
  route openFDA names the labels on file; the originator's label (an NDA,
  whose text the generic copies are required to carry) is taken when one
  exists, otherwise the newest copy. Each label's DailyMed page goes through
  the HTML adapter untouched. The reference's summary lists the drug's brand
  names and FDA drug class from NLM's RxNav, looked up by the configured
  generic name, leaving out combination products, and the routes available.
- **PDF**: pdfjs text is rebuilt into lines and paragraphs. The body font size
  is the size covering the most characters; lines at least 2pt larger are
  headings, larger sizes are higher levels, and a heading wrapped over two lines
  is joined. Lines repeated on more than half the pages (running headers,
  "Page 3 of 123") are dropped. Every block keeps its page number.
- **Sections**: each heading starts a section holding the text up to the next
  heading; deeper headings become its subsections. Text before the first
  heading becomes an "Opening text" section. A PDF section whose own text is
  longer than 12,000 characters is split into one subsection per page.
- **Dropped sections**: References, participant lists, abbreviation lists,
  literature search strategy, and recommendation categorization appendices
  (which repeat superseded wording from the previous edition). The run prints
  what was dropped for each document so a missed title is caught when the
  config is reviewed.

Each run fetches and parses every source before writing, then replaces the
references one by one in a single transaction. A source that parsed to no
sections (for a drug, any of its labels) is left as it was in the library, or
reported as one the run could not add. A source removed from the config
disappears, as does a later source that resolves to a url an earlier one
already covered (the run lists it as skipped).

## Config

`sources.json` is an array of entries like these. A PDF or HTML page:

```json
{
  "id": "va-dod-hypertension",
  "title": "VA-DoD Hypertension Guideline",
  "edition": "2026",
  "summary": "Adults; diagnosis, BP goals, drug choice, home monitoring",
  "url": "https://www.healthquality.va.gov/.../HTN-CPG_2026-Guideline_final_20260827.pdf",
  "type": "pdf"
}
```

A CDC syndicated page takes its media id instead of a url (the id is in the
page's [Media Library](https://tools.cdc.gov/medialibrary/index.aspx) address):

```json
{
  "id": "cdc-adult-schedule-by-age",
  "title": "CDC Adult Immunization Schedule by Age",
  "edition": "2025",
  "summary": "Which vaccines adults 19 and older get at each age",
  "type": "cdc-media",
  "mediaId": 266012
}
```

A drug label takes only the generic name as openFDA spells it:

```json
{ "id": "label-metoprolol-succinate", "type": "drug-label", "generic": "METOPROLOL SUCCINATE" }
```

`summary` is what the agent chooses from, so write it for that reader.

Drug-label summaries use RxNav. This product uses publicly available data
from the U.S. National Library of Medicine (NLM), National Institutes of
Health, Department of Health and Human Services. NLM is not responsible for
the product and does not endorse or recommend this or any other product.

## Running

```
npx tsx libs/reference-pipeline/src/cli.ts
```

Writes `libs/reference-pipeline/data/references.db` (gitignored) and prints
each document's outline. Requests to a host wait out the `Crawl-delay` its
robots.txt sets for all user agents (USPSTF asks for 5 seconds). Each attempt
is given up after 120 seconds, and a server error or rate limit is retried up
to four attempts with growing waits. The API reads the file from
`REFERENCE_DB_PATH`, or that default path.

```
npx tsx libs/reference-pipeline/src/audit.ts
```

Checks the built library for problems a reader of it would hit. It reports
sections with no text and no subsections, sections that are only links, HTML
tags left in the text, unreadable characters, text repeated from another
section, references with under 500 characters of text, an empty library, and
any reference or section whose search index row is missing, stale or left over.
It prints each check's count with examples, then the largest sections. It exits
with an error when no library exists at the path.

## Known limits

- Recommendations are not extracted as units with their strength. In the
  VA-DoD guidelines the per-recommendation headings are not set in a larger
  font, so each recommendation chapter is split by page (`page-34`), and a
  page can start mid-sentence. Recommendation tables come out as flowing text.
- Large-font cover page lines become sections ("and", "Office of Quality and
  Patient Safety ..."), so a guideline's chapters sit one level below its
  cover title in the outline.
- The "recommendation categorization" title rule also drops the short
  methodology subsection that explains the categories.
- HTML sections are never split and carry no anchor, only the page url, so a
  long table such as the USPSTF A and B list is one very long section. Each
  USPSTF recommendation page is also indexed on its own.
- A body line repeated on more than half of a PDF's pages, differing only in
  digits, is dropped as if it were a running header. On the configured VA-DoD
  guidelines every dropped line is a running header or page footer.
- Heading detection by font size assumes headings are larger than body text;
  a PDF that marks headings only with bold comes out as one "Opening text"
  section, split into one section per page once it passes 12,000 characters.
- A route's label is the newest one filed under an originator's application
  number, which can be a repackager's copy of it (the content is the
  originator's, the manufacturer named is the repackager), and a drug with
  several originator products takes whichever was updated last.
