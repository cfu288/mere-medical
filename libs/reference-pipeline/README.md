# reference-pipeline

Builds the reference library the chat agent reads. The pipeline fetches
published clinical guidance from configured sources,
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
as a guideline, a USPSTF recommendation page or a CDC schedule. It carries the
title, edition, summary and url a citation names.

A **section** (`sections`) is the text under one heading of a reference,
nested as the headings nest and numbered in reading order. The pipeline also
makes sections of its own for the text before the first heading ("Opening
text") and for each page of a PDF section too long to read at once.

The agent uses the two tables at different moments. It chooses a reference by
searching titles and summaries, then reads one section at a time. A guideline
is far too long to read whole, and searching the text of every section of
every reference would let one long guideline drown out a one-page CDC topic.
A citation needs both rows, the reference's title and url and the section's
page or own url. Section ids repeat across references (most CDC pages have a
"key-points"), so a section is always addressed as reference plus section
id. The two `_fts` tables are the full-text indexes behind the
two searches.

Example rows. The VA-DoD hypertension guideline:

| id                  | title                         | edition | summary                                                                                                                | url                                                                                                        |
| ------------------- | ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| va-dod-hypertension | VA-DoD Hypertension Guideline | 2026    | High blood pressure in adults: diagnosis, home and office measurement, blood pressure goals, and choice of medications | https://www.healthquality.va.gov/HEALTHQUALITY/guidelines/CD/htn/HTN-CPG_2026-Guideline_final_20260827.pdf |

| section_id                                                   | parent_id                                                    | position | title                                                                | page_start | page_end | url  | content_md                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------ | -------- | -------------------------------------------------------------------- | ---------- | -------- | ---- | ---------------------------------------------------------------- |
| ix-recommendations                                           | va-dod-clinical-practice-guideline-for-diagnosis-and-managem | 30       | IX. Recommendations                                                  | 26         | 28       | null | "The evidence-based clinical practice recommendations listed..." |
| b-treatment-goals-and-general-approaches-to-hypertension-man | ix-recommendations                                           | 37       | B. Treatment Goals and General Approaches to Hypertension Management | 33         | 33       | null | empty. Its text is split by page below                           |
| page-34                                                      | b-treatment-goals-and-general-approaches-to-hypertension-man | 39       | Page 34                                                              | 34         | 34       | null | "cardiovascular causes.(80,81) An additional SR by Matsumoto..." |

`parent_id` names a `section_id` in the same reference. A PDF section cites its
pages. A section's own `url`, when set, is the page it lives on.

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
  out site navigation and footers. Scripts, styles, `<noscript>`, frames,
  embedded objects and templates are dropped. A link or image whose address is
  not web, mail or relative (such as `javascript:` or `data:`) keeps only its
  text or alt text. Text that would open a Markdown link or an HTML tag, such
  as an encoded `<javascript:alert(1)>` or `<b>`, is escaped so it stays text.
- **CDC media**: CDC's content syndication API serves a page's content without
  site navigation. The media's metadata gives the cdc.gov page it syndicates,
  which becomes the reference url every read cites. The content then goes
  through the HTML adapter. CDC's own attribution block stays in the text.
  Prefer this over CDC PDFs.
- **PDF**: pdfjs text is rebuilt into lines and paragraphs. The body font size
  is the size covering the most characters. Lines at least 2pt larger are
  headings, larger sizes are higher levels, and a heading wrapped over two lines
  is joined. Lines repeated on more than half the pages (running headers,
  "Page 3 of 123") are dropped. Every block keeps its page number.
- **Sections**: each heading starts a section holding the text up to the next
  heading. Deeper headings become its subsections. Text before the first
  heading becomes an "Opening text" section. A PDF section whose own text is
  longer than 12,000 characters is split into one subsection per page.
- **Dropped sections**: References, participant lists, abbreviation lists,
  literature search strategy, and recommendation categorization appendices
  (which repeat superseded wording from the previous edition). The run prints
  what was dropped for each document so a missed title is caught when the
  config is reviewed.

Each run fetches and parses every source before writing, then replaces the
references one by one in a single transaction. A source that parsed to no
sections is left as it was in the library, or
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

`summary` is what the agent chooses from, so write it for that reader.

## Running

```
npx tsx libs/reference-pipeline/src/cli.ts
```

Writes `libs/reference-pipeline/data/references.db` (gitignored), prints
each document's outline, then prints the audit described below. Requests to a host wait out the `Crawl-delay` its
robots.txt sets for all user agents (USPSTF asks for 5 seconds). Each attempt
is given up after 120 seconds, and a server error or rate limit is retried up
to four attempts with growing waits.

The audit checks the built library for problems a reader of it would hit. It reports
sections with no text and no subsections, sections that are only links, HTML
tags left in the text, links that are not web, mail or relative addresses,
unreadable characters, text repeated from another
section, references with under 500 characters of text, an empty library, and
any reference or section whose search index row is missing, stale or left over.
It prints each check's count with examples, then the largest sections. To
audit an existing library without rebuilding it:

```
npx tsx libs/reference-pipeline/src/audit.ts
```

This exits with an error when no library exists at the path.

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
- Heading detection by font size assumes headings are larger than body text.
  A PDF that marks headings only with bold comes out as one "Opening text"
  section, split into one section per page once it passes 12,000 characters.
