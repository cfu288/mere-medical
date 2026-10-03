# reference-pipeline

Builds the reference library the chat agent reads: published clinical guidance
(guidelines, screening recommendations, schedules) fetched from configured HTML
and PDF sources, split into the sections their authors wrote, and stored in a
SQLite file the API serves.

## How the agent finds information

The agent finds a reference by searching the catalog (each reference's title
and summary), chooses from the ranked candidates, then moves from outline to
section, choosing from a short complete list at each step. Text search inside a
reference returns section pointers with a short excerpt around the best match.

Example: "Is my blood pressure where it should be?"

1. Read the patient's own record first (record and lab tools): conditions,
   recent readings. This decides which references matter.
2. `search_references(["high blood pressure", "hypertension", "BP"])` ranks
   references by how well their title and summary match any term (BM25), one
   row per reference, 20 per page, always with the total. Any word of any
   term can match, in any word form ("goals" matches "goal"); references
   matching more of the words rank higher:

   ```
   va-dod-hypertension | VA-DoD Hypertension Guideline | 2026 | High blood pressure in adults: diagnosis, ...
   va-dod-ckd | VA-DoD Chronic Kidney Disease Guideline | 2025 | Chronic kidney disease in adults ...
   Showing 1-2 of 2 references.
   ```

   The model chooses from the candidates. Ranking short titles and summaries
   is reliable where ranking whole document text was not, and the total means
   nothing is cut off silently. `list_references(page)` browses the whole
   catalog alphabetically, 50 per page, as a fallback.

3. `get_outline("va-dod-hypertension")` returns the top two levels of sections,
   each with the id the next call takes, its size, and where it sits in the
   source. Passing a section id expands that branch; from the real library,
   `get_outline("va-dod-hypertension", "ix-recommendations")`:

   ```
   b-treatment-goals-and-general-approaches-to-hypertension-man | B. Treatment Goals and General Approaches to Hypertension Management | 0 chars | p. 33
     page-33-2 | Page 33 | 925 chars | p. 33
     page-34 | Page 34 | 3744 chars | p. 34
   ```

4. `read_section("va-dod-hypertension", "page-34")` returns that section's own
   text with the reference title, edition, url, and location, plus the ids of
   its subsections.
5. Fallback when titles are not enough:
   `find_in_reference("va-dod-hypertension", ["systolic goal", "<130", "blood pressure goal"])`
   returns `section id | title | match count` for sections matching any term,
   for example `page-34 | Page 34 | 6 matches`.

Every response is bounded by its unit (a page of catalog rows, two outline
levels, one section, a list of pointers), never by cutting text at a character
budget, and a paged response always states its total.

## Interface

Every endpoint the agent calls lives under `/api/v1/agent`; future CDS Hooks
services belong there too, at `/api/v1/agent/cds-services`.

| Agent tool                              | Endpoint                                                | Returns                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_references(terms[], page?)`     | `GET /api/v1/agent/references/search?q=a&q=b&page=1`    | `{ references: [{ id, title, edition, summary, url }], total, page, pageSize }`, ranked by BM25 over title and summary, terms combined with OR, 20 per page    |
| `list_references(page?)`                | `GET /api/v1/agent/references?page=1`                   | `{ references, total, page, pageSize }`, alphabetical by title, 50 per page                                                                                    |
| `get_outline(reference, section?)`      | `GET /api/v1/agent/references/:id/outline[/:sectionId]` | `{ reference, section, sections }`: the expanded section's own entry (null for the whole reference) and the top two levels below it, with ids and child counts |
| `read_section(reference, section)`      | `GET /api/v1/agent/references/:id/sections/:sectionId`  | `{ reference, section: { title, location, contentMd, subsections } }`                                                                                          |
| `find_in_reference(reference, terms[])` | `GET /api/v1/agent/references/:id/find?q=a&q=b`         | `{ matches: [{ sectionId, title, count, excerpt }] }`, terms combined with OR, in document order                                                               |

- Documents and sections are addressed by id, and every list prints the ids the
  next call takes.
- `location` is `{ kind: 'pages', start, end }` for PDFs and `{ kind: 'webpage' }`
  for HTML, where the reference url is the citation.
- An unknown reference or section answers 404 with
  `{ error: 'no-reference' | 'no-section' }`; the agent tool turns that into the
  next step to take.

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
- **Drug labels**: the config names a generic drug. Ingest finds the newest
  prescription label for that generic in openFDA, from any manufacturer (the
  prescribing text is the same), fetches its DailyMed
  printer-friendly page through the HTML adapter, and builds the title,
  edition, and summary itself. The summary lists the drug's brand names and FDA
  drug class from NLM's RxNav, looked up for the exact form on the label
  (metoprolol succinate and metoprolol tartrate get their own brands), leaving
  out combination products.
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
whole library in one transaction, so a failed fetch leaves the previous library
intact and sources removed from the config disappear.

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
robots.txt sets for all user agents (USPSTF asks for 5 seconds). The API reads the file from `REFERENCE_DB_PATH`, or
that default path.

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
