# reference-pipeline

Builds the reference library the chat agent reads: published clinical guidance
(guidelines, screening recommendations, schedules) and FDA drug labels, fetched
from configured sources, split into the sections their authors wrote, and
stored in a SQLite file the API serves.

## Schema

The library holds two kinds of thing, and the agent uses them at two different
moments.

A **reference** (`documents` table) is one published work you could cite by
name: the VA-DoD hypertension guideline, the USPSTF page on screening for
hypertension, the CDC adult immunization schedule, the FDA labels for
estradiol. It has a title, an edition year, a one-line summary and the url a
citation points to. There are 406 of them: 295 CDC pages, 50 drug labels, 48
USPSTF recommendations and 13 VA-DoD guidelines. This is the table the agent
chooses from when it decides _which work to open_.

A **section** (`sections` table) is one heading's worth of text inside a
reference, in the order the authors wrote it, nested the way the work's table
of contents nests: chapter, then heading, then subheading. It has a title, the
text under that heading (and only that heading), its parent heading, its place
in reading order, and where it sits in the source (page numbers for a PDF, its
own web page for a drug label). This is the table the agent reads from once it
has opened a work and is deciding _which part to read_.

Why not one table of text chunks? Three facts about the material, with the
numbers from the built library:

- **A work is far too big to read; a section is the right size.** The
  hypertension guideline is 111 pages and 234,096 characters of text; the
  estradiol labels together are 273,496. The whole library is 13.9 million.
  The agent reads one section at a time (`page-34` is 3,744 characters), so
  the unit it reads has to be stored as its own row, with enough around it
  (parent, position, siblings) to move to the next one.
- **Finding the right work and finding the right page are different
  searches.** Searching all 13.9 million characters for "blood pressure goal"
  would return thousands of passages from hundreds of works, with the 99
  sections of one guideline drowning out a one-section CDC page. Instead the
  agent first searches only the 406 titles and summaries ("which work?", 18
  hits in the example below), then searches the text of the one work it chose
  ("which page?", 23 hits). The two tables are those two searches; the two
  `_fts` tables are SQLite's full-text indexes over them.
- **A citation needs both.** "VA-DoD Hypertension Guideline (2026), p. 34" is
  the reference's name and edition plus the section's page. A section cannot
  stand alone: the heading "2 DOSAGE AND ADMINISTRATION" appears in 56 labels,
  so a section is addressed as reference plus section id, never by its id
  alone.

A drug is deliberately one reference, not one per label. The agent picks
"estradiol" once from the catalog and then sees its four routes (oral, topical,
transdermal, vaginal) as the top-level sections, each holding one full label.
Fifty drugs as 70 catalog rows that all match "estradiol" equally would make
the first search worse and tell the agent nothing the outline does not.

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

`position` is reading order within the reference. `parent_id` is the heading
this one sits under, null for a top-level one. `page_start`/`page_end` are set
for PDF sources and null for web sources; `url` is set only where a section
cites a page of its own (a drug label's route) and null where the reference's
url is the citation.

The rows the end-to-end examples below read, from the library built on
2026-10-04. The guideline `va-dod-hypertension` is one `documents` row and 99
`sections` rows; four of them:

| id                  | title                         | edition | summary                                                                                                                | url                                                                                                        |
| ------------------- | ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| va-dod-hypertension | VA-DoD Hypertension Guideline | 2026    | High blood pressure in adults: diagnosis, home and office measurement, blood pressure goals, and choice of medications | https://www.healthquality.va.gov/HEALTHQUALITY/guidelines/CD/htn/HTN-CPG_2026-Guideline_final_20260827.pdf |

| section_id                                                   | parent_id                                                    | position | title                                                                | page_start | page_end | url  | content_md                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------ | -------- | -------------------------------------------------------------------- | ---------- | -------- | ---- | --------------------------------------------------------------------------------------------------- |
| ix-recommendations                                           | va-dod-clinical-practice-guideline-for-diagnosis-and-managem | 30       | IX. Recommendations                                                  | 26         | 28       | null | 6,424 chars: "The evidence-based clinical practice recommendations listed in the table below w..."  |
| b-treatment-goals-and-general-approaches-to-hypertension-man | ix-recommendations                                           | 37       | B. Treatment Goals and General Approaches to Hypertension Management | 33         | 33       | null | empty: the heading's text is split by page below                                                    |
| page-33-2                                                    | b-treatment-goals-and-general-approaches-to-hypertension-man | 38       | Page 33                                                              | 33         | 33       | null | 925 chars: "a. Blood Pressure Goals ... Recommendation 4. For individuals with hypertension, we..." |
| page-34                                                      | b-treatment-goals-and-general-approaches-to-hypertension-man | 39       | Page 34                                                              | 34         | 34       | null | 3,744 chars: "cardiovascular causes.(80,81) An additional SR by Matsumoto et al. (2025) found..."   |

A drug, `label-estradiol`: one reference for the generic, one top section per
route it is sold in (the spoke), that route's full label nested under it.

| id              | title                     | edition | summary                                                                                                                                                             | url                                                                            |
| --------------- | ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| label-estradiol | FDA drug label: Estradiol | 2026    | Estradiol (brands: Alora, Climara, Delestrogen, Depo-estradiol, Divigel, Dotti, Elestrin, Estrace, Estring, Estrogel, Evamist, Femring, Imvexxy, Lyllana, Menost... | https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=estradiol |

| section_id                              | parent_id   | position | title                       | page_start | url                                                                                                              | content_md                                                                                       |
| --------------------------------------- | ----------- | -------- | --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| transdermal                             | null        | 103      | Transdermal: Minivelle      | null       | https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=6c5c47ab-28ee-11e1-bfc2-0800200c9a66&type=display | Label NDA203752 by Noven Therapeutics, LLC, effective 2026-07-31.                                |
| transdermal-2-dosage-and-administration | transdermal | 119      | 2 DOSAGE AND ADMINISTRATION | null       | (the same DailyMed url)                                                                                          | 742 chars: "Generally, when estrogen is prescribed for a postmenopausal woman with a uterus,..." |

The transdermal spoke has 34 direct subsections; the oral, topical and vaginal
spokes sit beside it at positions 0, 25 and 175.

## How the agent reads the library, end to end

The agent's tools are the web app's reference tools; each one is a GET on the
API's `/api/v1/agent/references` routes, which read this file. Every output
below is the real tool output against the library described above, cut only
where marked.

### A guideline question: "Is my blood pressure where it should be?"

1. The agent reads the patient's own record first (record and lab tools):
   conditions, recent readings. That decides which references matter.
2. `search_references({"query": ["high blood pressure", "hypertension", "BP"]})`
   ranks references by how well title and summary match any term (FTS5 BM25),
   20 per page, always with the total:

   ```
   va-dod-hypertension | VA-DoD Hypertension Guideline | 2026 | High blood pressure in adults: diagnosis, home and office measurement, blood pressure goals, and choice of medications
   cdc-manage-blood-sugar | CDC: Manage Blood Sugar | 2023 | Find info about how and when to test blood sugar, managing high and low blood sugar, and more.
   cdc-undiagnosed-hypertension | CDC: Undiagnosed Hypertension | 2023 | Undiagnosed Hypertension
   uspstf-hypertensive-disorders-pregnancy-screening | USPSTF: Hypertensive Disorders of Pregnancy: Screening | 2023 | asymptomatic pregnant persons (grade B)
   [14 rows cut here]
   Showing 1-18 of 18 references. Call get_outline with a reference id to see its sections.
   ```

   The model chooses from the candidates. `list_references({"page": 1})`
   browses the whole catalog alphabetically by title, 50 per page, as a
   fallback.

3. `get_outline({"reference": "va-dod-hypertension"})` returns the top two
   levels of sections, each with the id the next call takes, its size, and
   where it sits in the source. Passing a section id expands that branch:
   `get_outline({"reference": "va-dod-hypertension", "section": "ix-recommendations"})`

   ```
   VA-DoD Hypertension Guideline (2026)
   ix-recommendations | IX. Recommendations | 6424 chars | pp. 26-28 | has its own text: read_section to read it
     a-diagnosis-and-monitoring | A. Diagnosis and Monitoring | 0 chars | p. 29
       page-29 | Page 29 | 3054 chars | p. 29
   [rows cut here]
     b-treatment-goals-and-general-approaches-to-hypertension-man | B. Treatment Goals and General Approaches to Hypertension Management | 0 chars | p. 33
       page-33-2 | Page 33 | 925 chars | p. 33
       page-34 | Page 34 | 3744 chars | p. 34
   [rows cut here]
   Call read_section with a section id to read it, or get_outline with a section id to expand it.
   ```

   These are the `sections` rows shown above, rendered one per line.

4. `read_section({"reference": "va-dod-hypertension", "section": "page-34"})`
   returns that section's own text under its citation (reference, title,
   pages, url), then the ids of its subsections when it has any:

   ```
   VA-DoD Hypertension Guideline (2026) > Page 34, p. 34
   https://www.healthquality.va.gov/HEALTHQUALITY/guidelines/CD/htn/HTN-CPG_2026-Guideline_final_20260827.pdf

   cardiovascular causes.(80,81) An additional SR by Matsumoto et al. (2025) found no significant difference in composite cardiovascular outcome in individuals with HFpEF; [text cut here]
   ```

5. When titles are not enough,
   `find_in_reference({"reference": "va-dod-hypertension", "query": ["systolic goal", "<130", "blood pressure goal"]})`
   lists the sections matching any term, in document order, each with its
   match count and an excerpt around the best match, and says how many it
   left out:

   ```
   [4 rows cut here]
   module-b-treatment | Module B. Treatment | 58 matches | …Blood Pressure Goals/Targets Systolic Blood Pressure Goal (see
   ix-recommendations | IX. Recommendations | 50 matches | …For individuals with hypertension, we recommend treating to a t
   page-29 | Page 29 | 37 matches | …various blood pressure levels and the goal blood pressures that lead to reduction in a
   [2 rows cut here]
   page-34 | Page 34 | 16 matches | …from one SR including 12 RCTs that intensive systolic blood pressure control (SBP goal
   [5 rows cut here]
   [12 more omitted; narrow the terms]
   ```

### A drug question: "How do I use my estradiol patch?"

1. `search_references({"query": ["estradiol", "estrogen patch"]})` finds the
   drug's one node:

   ```
   label-estradiol | FDA drug label: Estradiol | 2026 | Estradiol (brands: Alora, Climara, Delestrogen, Depo-estradiol, Divigel, Dotti, Elestrin, Estrace, Estring, [summary cut here]
   Showing 1-1 of 1 references. Call get_outline with a reference id to see its sections.
   ```

2. `get_outline({"reference": "label-estradiol"})` shows the routes as the
   top level, each a spoke holding one label:

   ```
   FDA drug label: Estradiol (2026)
   oral | Oral: Estradiol | 56 chars
   [its subsections cut here]
   topical | Topical: Estradiol | 66 chars
   [its subsections cut here]
   transdermal | Transdermal: Minivelle | 65 chars
   [its subsections cut here]
   vaginal | Vaginal: Estring | 76 chars
   [its subsections cut here]
   Call read_section with a section id to read it, or get_outline with a section id to expand it.
   ```

3. `get_outline({"reference": "label-estradiol", "section": "transdermal"})`
   expands the patch label; its section ids carry the route as a prefix so
   the same heading in another route's label is a different id:

   ```
   FDA drug label: Estradiol (2026)
   transdermal | Transdermal: Minivelle | 65 chars | has its own text: read_section to read it
     transdermal-opening-text | Opening text | 310 chars
     transdermal-highlights-of-prescribing-information | HIGHLIGHTS OF PRESCRIBING INFORMATION | 224 chars
   [rows cut here]
     transdermal-2-dosage-and-administration | 2 DOSAGE AND ADMINISTRATION | 742 chars
       transdermal-2-1-treatment-of-moderate-to-severe-vasomotor-symptoms-due-t | 2.1 Treatment of Moderate to Severe Vasomotor Symptoms due to Menopause | 201 chars
   [rows cut here]
   Call read_section with a section id to read it, or get_outline with a section id to expand it.
   ```

4. `read_section({"reference": "label-estradiol", "section": "transdermal-2-dosage-and-administration"})`
   cites the spoke's own DailyMed page (the `url` on that row), not the node's
   search page:

   ```
   FDA drug label: Estradiol (2026) > 2 DOSAGE AND ADMINISTRATION
   https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=6c5c47ab-28ee-11e1-bfc2-0800200c9a66&type=display

   Generally, when estrogen is prescribed for a postmenopausal woman with a uterus, consider addition of a progestogen to reduce the risk of endometrial cancer. [text cut here]

   Subsections: transdermal-2-1-treatment-of-moderate-to-severe-vasomotor-symptoms-due-t (2.1 Treatment of Moderate to Severe Vasomotor Symptoms due to Menopause, 201 chars); transdermal-2-3-application-instructions (2.3 Application Instructions, 1172 chars)
   ```

   Reading the spoke itself,
   `read_section({"reference": "label-estradiol", "section": "transdermal"})`,
   gives the label's provenance and the full list of its sections:

   ```
   FDA drug label: Estradiol (2026) > Transdermal: Minivelle
   https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=6c5c47ab-28ee-11e1-bfc2-0800200c9a66&type=display

   Label NDA203752 by Noven Therapeutics, LLC, effective 2026-07-31.

   Subsections: transdermal-opening-text (Opening text, 310 chars); [34 entries, cut here]
   ```

Every response is bounded by its unit (a page of catalog rows, two outline
levels, one section, a list of pointers), never by cutting text at a character
budget; a paged response states its total and a cut list says how many rows it
left out.

## Pipeline

```
fetch -> adapter (html | pdf) -> blocks (headings + text) -> sections -> SQLite
```

Each format has its own adapter that produces the same blocks; everything after
that is shared and does not know the source format.

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
  reference per generic, the node the agent finds first, with one section per
  route the drug is sold in (oral, transdermal, inhalation, ...), each holding
  that route's full label as its subsections and citing its own DailyMed page.
  For each route openFDA names the labels on file; the originator's label (an
  NDA, whose text the generic copies are required to carry) is taken when one
  exists, otherwise the newest copy. Each label's DailyMed page goes through
  the HTML adapter untouched. The node's summary lists the drug's brand names
  and FDA drug class from NLM's RxNav, looked up by the configured generic
  name (so metoprolol succinate and metoprolol tartrate get their own brands),
  leaving out combination products, and the routes available.
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
sections is left as it was in the library (or reported as one the run could
not add), and a source removed from the config disappears. The run prints each
reference's outline, what it dropped, and which references it kept or could
not add.

## Config

`sources.json`:

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

Drug-label summaries use RxNav: this product uses publicly available data from
the U.S. National Library of Medicine (NLM), National Institutes of Health,
Department of Health and Human Services; NLM is not responsible for the product
and does not endorse or recommend this or any other product.

## Running

```
npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' libs/reference-pipeline/src/cli.ts
```

Writes `libs/reference-pipeline/data/references.db` (gitignored) and prints
each document's outline. Requests to a host wait out the `Crawl-delay` its
robots.txt sets for all user agents (USPSTF asks for 5 seconds), and any
request is given up after 120 seconds. The API reads the file from
`REFERENCE_DB_PATH`, or that default path.

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
- HTML sections are never split and carry no anchor, only the page url; the
  USPSTF A and B table is one 24,550 character section, and each USPSTF
  recommendation page is also indexed on its own.
- Heading detection by font size assumes headings are larger than body text;
  a PDF that marks headings only with bold comes out as one section per page.
- A route's label is the newest one filed under an originator's application
  number, which can be a repackager's copy of it (the content is the
  originator's, the manufacturer named is the repackager), and a drug with
  several originator products takes whichever was updated last.
