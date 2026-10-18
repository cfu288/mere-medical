# reference-pipeline

Builds the clinical reference library for the chat agent. It fetches guidelines,
converts each one to markdown, and saves them in a SQLite file.

## How it works

`npx nx run reference-pipeline:build-library` runs `src/cli.ts`, which takes
these steps.

1. `parseSources` reads `sources.json`.
2. `buildReferenceLibrary` takes each source in turn.
   1. It fetches the page or PDF with the fetch from `createRateLimitedFetch`.
      A `cdc-media` source goes through `fetchCdcMediaPage`.
   2. `htmlToBlocks` or `pdfToBlocks` turns it into a list of headings and
      text, called blocks.
   3. `blocksToDocument` turns the blocks into one markdown document, its
      sections and their parts.
3. `buildReferenceLibrary` then stores each reference in the SQLite file with
   `writeReference`.

The chat agent reads the file. It never fetches a source itself.

## Concepts

A **reference** is one published guideline or web page. Each reference is one
row in `documents`. The row holds the whole reference as markdown.

A **block** is one heading or one run of text, in reading order. `htmlToBlocks`
and `pdfToBlocks` turn a source into a list of blocks. Web pages and PDFs then
reach `blocksToDocument` in the same form. The library does not store blocks.

A **section** is one heading block and the text blocks after it, up to the next
heading. `blocksToDocument` makes the sections from the blocks and nests them as
the headings nest. `pdfToBlocks` starts each PDF page with a "Page N" heading,
so each page is one section. A guideline is too long to read at once, so the
agent reads one section at a time. The row's `sections` column gives where each
section's text starts and ends in `content_md`.

A **part** is up to 10,000 characters of one section's text. Each part is one
row in `parts_fts`. A search inside a reference matches parts, so a match points
to a short piece of text. The agent reads a long section one part at a time.

## Converting a reference

- In HTML, a heading is an `<h1>` to `<h6>` element.
- Each PDF page becomes a section titled "Page N". The pipeline ignores a PDF's
  own headings and bookmarks. Publishers mark them in different ways.
- Each heading becomes a `#` line in the markdown, one `#` per level.
- A lower-level heading starts a subsection. `parentId` names the section above
  it.
- Text before the first heading becomes an "Opening text" section.
- A heading with no text of its own is still a section. Its text is empty.
- A section id comes from its title. It is unique within its reference.
- Each section's text splits into parts of at most 10,000 characters. A part
  ends at the last paragraph break, line break or space that fits.

The conversion is deterministic. The same source gives the same markdown and
sections.

## Reading a reference

1. Search reference titles and summaries in `documents_fts` to choose a
   reference.
2. List that reference's sections. This is its outline.
3. Search that reference's parts in `parts_fts`, filtered by `document_id`. This
   finds the section and part that mention a term. It never searches other
   references.
4. Read one part by `document_id`, `section_id` and `part`.

A citation names the reference's title and url. For a PDF it also names the
page, which is the section's title.

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
CREATE VIRTUAL TABLE documents_fts USING fts5(id UNINDEXED, title, summary, tokenize = 'porter unicode61');
CREATE VIRTUAL TABLE parts_fts USING fts5(document_id UNINDEXED, section_id UNINDEXED, part UNINDEXED, text, tokenize = 'porter unicode61');
```

`content_md` is the whole reference as markdown. `sections` is a JSON list of
its sections in reading order. `documents_fts` is a full-text index of titles
and summaries. `parts_fts` holds each part's text and indexes it. `textStart`
and `textEnd` count JavaScript string positions in `content_md`.

This entry of `sections` is page 34 of the VA-DoD hypertension guideline.

```json
{
  "sectionId": "page-34",
  "parentId": null,
  "title": "Page 34",
  "textStart": 82194,
  "textEnd": 86057
}
```

## Sources

`sources.json` lists every reference. Each entry has an `id`, `title`,
`edition`, `summary` and `type`. `edition` is the version or date the publisher
gives. The agent picks a reference by its title and summary.

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
  `<article>`, the pipeline reads only that element. It drops scripts, styles,
  noscript fallbacks, frames, objects and `<nav>` menus. Every link keeps only
  its text, and every image its alt text. A table whose cells hold headings,
  lists, rules, quotes or code becomes plain text. A markdown table cannot hold
  them.
- `cdc-media` reads a CDC page's text through CDC's content API, without the
  site's menus. It takes a `mediaId` instead of a `url`. The id is in the page's
  [Media Library](https://tools.cdc.gov/medialibrary/index.aspx) address.
- `pdf` reads a PDF from `url`. Each PDF page becomes a section holding that
  page's lines.

## Running

```
npx nx run reference-pipeline:build-library
```

The run writes `libs/reference-pipeline/data/references.db` and prints one line
per source, with its section count or a note that the run left it out. Its last
line gives the number of references written. It builds a new file and then
replaces the old one. If any fetch fails, the run stops with an error and the
old file stays. The run leaves out a source with no text outside its headings.
Requests to a host wait for the `Crawl-delay` in its robots.txt.

## Known limits

- A web page with no single `<main>` and no single `<article>` keeps its header and
  footer text, such as links outside `<nav>` and newsletter forms.
- When a source answers with a bot check, the pipeline stores the check page's
  text.
