# reference-pipeline

Builds the clinical reference library for the chat agent. It fetches guidelines,
splits them into sections, and saves them in a SQLite file.

## Concepts

A **reference** is one published guideline or web page. Each reference is one
row in `documents`.

A **section** is one chunk of a reference. A guideline is too long to read at
once, so the agent reads one section at a time. Each section is one row in
`sections`.

## Splitting a reference

The pipeline splits each reference at its headings. The split is deterministic.
The same source gives the same sections.

- A heading starts a section. The section holds the text up to the next heading.
- A lower-level heading starts a subsection. `parent_id` names the section above
  it.
- `position` is the reading order.
- Text before the first heading becomes an "Opening text" section.
- The pipeline splits a PDF section over 12,000 characters into one subsection
  per page.
- The pipeline drops back matter such as reference lists and abbreviation lists.
- A section id comes from its title. It is unique within its reference.

In HTML, a heading is an `<h1>` to `<h6>` element. In a PDF, a heading is a line
at least 2pt larger than the body text.

## Reading sections

1. Search reference titles and summaries in `documents_fts`.
2. List one reference's outline. This is its sections in `position` order.
3. Search the text of that reference's sections in `sections_fts`.
4. Read one section by `document_id` and `section_id`.

A citation names the reference's title and url. It also names the section's
pages or url.

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
CREATE VIRTUAL TABLE documents_fts USING fts5(id UNINDEXED, title, summary, content = 'documents', tokenize = 'porter unicode61');
CREATE VIRTUAL TABLE sections_fts USING fts5(document_id UNINDEXED, section_id UNINDEXED, title, content_md, content = 'sections', tokenize = 'porter unicode61');
-- plus one insert trigger per table that adds each new row to its index
```

The `_fts` tables are full-text indexes. They hold no text of their own.

These sections come from the VA-DoD hypertension guideline.

| section_id                                                   | parent_id                                                    | position | title                                                                | page_start | page_end | content_md                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------ | -------- | -------------------------------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------- |
| ix-recommendations                                           | va-dod-clinical-practice-guideline-for-diagnosis-and-managem | 30       | IX. Recommendations                                                  | 26         | 28       | "The evidence-based clinical practice recommendations listed..." |
| b-treatment-goals-and-general-approaches-to-hypertension-man | ix-recommendations                                           | 37       | B. Treatment Goals and General Approaches to Hypertension Management | 33         | 33       | empty. Its text is split by page below                           |
| page-34                                                      | b-treatment-goals-and-general-approaches-to-hypertension-man | 39       | Page 34                                                              | 34         | 34       | "cardiovascular causes.(80,81) An additional SR by Matsumoto..." |

## Sources

`sources.json` lists every reference. Each entry has an `id`, `title`,
`edition`, `summary` and `type`. The agent picks a reference by its summary.

```json
{
  "id": "va-dod-hypertension",
  "title": "VA-DoD Hypertension Guideline",
  "edition": "2026",
  "summary": "High blood pressure in adults. It covers diagnosis, home and office measurement, blood pressure goals, and choice of medications",
  "url": "https://www.healthquality.va.gov/.../HTN-CPG_2026-Guideline_final_20260827.pdf",
  "type": "pdf"
}
```

There are three types.

- `html` reads a web page from `url`. When the page has one `<main>` or one
  `<article>`, the pipeline reads only that element. It drops scripts, and
  unsafe links keep only their text.
- `cdc-media` reads a CDC page through CDC's syndication API, without site
  navigation. It takes a `mediaId` instead of a `url`. The id is in the page's
  [Media Library](https://tools.cdc.gov/medialibrary/index.aspx) address.
- `pdf` reads a PDF from `url`. The pipeline drops lines that repeat on most
  pages, such as running headers. Each section keeps its page numbers.

## Running

```
npx tsx libs/reference-pipeline/src/cli.ts
```

The run writes `libs/reference-pipeline/data/references.db` and prints each
reference's outline. It builds a new file and then replaces the old one. If a
fetch fails, the old file stays. The run reports a source with no sections and
leaves it out. Requests to a host wait for the `Crawl-delay` in its robots.txt.

## Known limits

- VA-DoD recommendations have no headings of their own. Their chapters are split
  by page, so a page can start mid-sentence.
- Large-font cover page lines become sections.
- HTML sections are never split. A long page table is one long section.
- A PDF that marks headings with bold instead of size becomes one "Opening text"
  section, split by page.
