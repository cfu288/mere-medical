# reference-pipeline

This library builds the clinical reference library that the chat agent uses to
answer questions. It fetches the guidelines listed in `sources.json`, converts
each one to markdown, and saves them all in one SQLite file. The chat agent only
reads that file and never fetches a source itself.

## How it works

Running `npx nx run reference-pipeline:build-library` starts `src/cli.ts`, which
takes these steps.

1. The CLI reads `sources.json`, and `parseSources` checks each entry.
2. `buildReferenceLibrary` then works through the sources one at a time.
   1. It fetches the page or PDF with the function that `createRateLimitedFetch`
      returns, which waits between requests to the same host. For a `cdc-media`
      source, `fetchCdcMediaPage` uses that same function to call CDC's content
      API.
   2. `htmlToBlocks` or `pdfToBlocks` turns the page into a flat list of
      headings and text, called blocks.
   3. `blocksToDocument` turns the blocks into one markdown document, a list of
      its sections, and the parts of each section.
3. After converting every source, `buildReferenceLibrary` stores each one that
   has text besides its headings in the SQLite file with `writeReference`.

## Concepts

A **reference** is one published guideline or web page. Each reference is one
row in `documents`, and that row holds the whole reference as markdown.

A **block** is one heading or one piece of text, such as a paragraph of a web
page or the lines of one PDF page. `htmlToBlocks` and `pdfToBlocks` turn web
pages and PDFs into the same kind of list. Then `blocksToDocument` uses the same
code for both formats. The library does not store blocks.

A **section** is a heading plus the text under it, up to the next heading.
`blocksToDocument` builds the sections from the blocks. `pdfToBlocks` adds a
"Page N" heading at the start of each PDF page, so each page becomes one
section. A full guideline is too long for the agent to read at once, which is
why it works through a reference by section. The row's `sections` column records
where each section's text starts and ends in `content_md`, not counting the
heading line.

A **part** is up to 10,000 characters of one section's text, stored as one row
in `parts_fts`. A search within a reference matches parts, so a match points to
a short piece of text rather than a whole section. The agent also reads a long
section one part at a time.

## Converting a reference

- In HTML, a heading is an `<h1>` to `<h6>` element.
- Each PDF page becomes a section titled "Page N". A PDF's own headings stay as
  plain text. Publishers mark headings in PDFs in many ways.
- Each heading becomes a `#` line in the markdown, with one `#` per level.
- A heading nested under another, such as an `<h3>` after an `<h2>`, starts a
  subsection. Its `parentId` names the section it sits in.
- Text before the first heading becomes an "Opening text" section.
- A heading with no text of its own is still a section, with empty text.
- A section id comes from its title and is unique within its reference.
- Each section's text splits into parts of at most 10,000 characters. A part
  ends at the last paragraph break that fits. If there is no paragraph break, it
  ends at the last line break. If there is no line break, it ends at the last
  space. If there is no space, the part ends at 10,000 characters.

The conversion is deterministic, so the same fetched page always gives the same
markdown and sections.

## Reading a reference

The chat agent reads a reference in four steps.

1. It searches titles and summaries in `documents_fts` to choose a reference.
2. It lists that reference's sections, which act as its outline.
3. It searches that reference's parts in `parts_fts`, filtered by `document_id`,
   to find the parts that mention a term.
4. It reads one part by its `document_id`, `section_id` and part number.

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

`content_md` holds the whole reference as markdown, and `sections` is a JSON
list of its sections in reading order. `textStart` and `textEnd` are JavaScript
string indexes into `content_md`. `documents_fts` indexes titles and summaries
for search, and `parts_fts` holds and indexes the text of each part.

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
`edition`, `summary` and `type`, plus either a `url` or a `mediaId` depending on
the type. `edition` is the version or date the publisher gives. The agent
chooses a reference by its title and summary, so these must say what the
reference covers.

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

- `html` fetches a web page from `url`. If the page has exactly one `<main>`,
  the pipeline reads only that. If not, and the page has exactly one
  `<article>`, it reads only that. It drops scripts, styles, noscript fallbacks,
  frames, objects and `<nav>` menus. Links keep only their text, and images keep
  only their alt text. A markdown table cannot hold headings, lists, horizontal
  rules, block quotes or code blocks. A table with any of these in its cells
  loses its table layout but keeps the cells' content.
- `cdc-media` fetches a CDC page's text through CDC's content API, which leaves
  out the site's menus. It takes a `mediaId` instead of a `url`. You can find
  the id in the page's [Media
  Library](https://tools.cdc.gov/medialibrary/index.aspx) address.
- `pdf` fetches a PDF from `url`. Each page becomes a section holding that
  page's lines.

## Running

```
npx nx run reference-pipeline:build-library
```

The run writes `libs/reference-pipeline/data/references.db` and prints one line
per source, with either its section count or a note that the run left it out.
The run leaves out a source with no text besides its headings. The last line
gives the number of references written.

The run builds a new file and only replaces the old one after writing every
reference. If any step fails, the run stops with an error and the old file stays
as it was.

## Known limits

- A web page with no single `<main>` and no single `<article>` keeps its header
  and footer text, such as links outside `<nav>` and newsletter forms.
- When a source answers with a bot check, the pipeline stores the text of the
  check page.
