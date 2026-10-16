# reference-pipeline

Builds the clinical reference library for the chat agent. It fetches guidelines,
converts each one to markdown, and saves them in a SQLite file.

## Concepts

A **reference** is one published guideline or web page. Each reference is one
row in `documents`. The row holds the whole reference as markdown.

A **section** is one heading of a reference and the text under it, up to the
next heading. A guideline is too long to read at once, so the agent reads one
section at a time. The row lists the sections, with where each one's text starts
and ends in the markdown.

## Converting a reference

- In HTML, a heading is an `<h1>` to `<h6>` element. In a PDF, a heading is a
  line at least 2 points larger than the most common font size.
- Each heading becomes a `#` line in the markdown, one `#` per level.
- Each new PDF page starts with a `<!-- page N -->` line.
- A lower-level heading starts a subsection. `parentId` names the section above
  it.
- Text before the first heading becomes an "Opening text" section.
- A heading with no text of its own is still a section. Its text is empty.
- A section id comes from its title. It is unique within its reference.

The conversion is deterministic. The same source gives the same markdown and
sections.

## Reading a reference

1. Search reference titles and summaries in `documents_fts`.
2. List one reference's sections. This is its outline.
3. Read one section. Its text is `content_md` from `textStart` to `textEnd`. A
   long section is read in parts.

A citation names the reference's title and url. It also names the section's
pages.

## Schema

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  edition TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT NOT NULL,
  content_md TEXT NOT NULL,
  sections TEXT NOT NULL
);
CREATE VIRTUAL TABLE documents_fts USING fts5(id UNINDEXED, title, summary, content = 'documents', tokenize = 'porter unicode61');
-- plus an insert trigger that adds each new row to documents_fts
```

`content_md` is the whole reference as markdown. `sections` is a JSON list of
its sections in reading order. `documents_fts` is a full-text index of titles
and summaries. It holds no text of its own.

This entry of `sections` comes from the VA-DoD hypertension guideline.

```json
{
  "sectionId": "b-treatment-goals-and-general-approaches-to-hypertension-man",
  "parentId": "ix-recommendations",
  "title": "B. Treatment Goals and General Approaches to Hypertension Management",
  "location": { "kind": "pages", "start": 33, "end": 41 },
  "textStart": 78133,
  "textEnd": 104700
}
```

`location` is `{ "kind": "webpage" }` for a web page.

## Sources

`sources.json` lists every reference. Each entry has an `id`, `title`,
`edition`, `summary` and `type`. `edition` is the version or date the publisher
gives. The agent picks a reference by its summary.

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
  `<article>`, the pipeline reads only that element. It drops scripts. A link
  that is not http, https, mailto or relative keeps only its text.
- `cdc-media` reads a CDC page's text through CDC's content API, without the
  site's menus. It takes a `mediaId` instead of a `url`. The id is in the page's
  [Media Library](https://tools.cdc.gov/medialibrary/index.aspx) address.
- `pdf` reads a PDF from `url`. The pipeline drops lines that repeat on most
  pages, such as a running title or a page number. Each section keeps its page
  numbers.

## Running

```
npx tsx libs/reference-pipeline/src/cli.ts
```

The run writes `libs/reference-pipeline/data/references.db` and prints each
reference's outline. It builds a new file and then replaces the old one. If any
fetch fails, the run stops with an error and the old file stays. The run reports
a source with no sections and leaves it out. Requests to a host wait for the
`Crawl-delay` in its robots.txt.

## Known limits

- VA-DoD recommendations have no headings of their own. Each chapter is one long
  section.
- Large-font cover page lines become sections.
- A PDF that marks headings with bold instead of size becomes one "Opening text"
  section.
