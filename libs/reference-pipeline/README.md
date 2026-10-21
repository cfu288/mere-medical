# reference-pipeline

This code builds the clinical reference library that the chat agent uses to
answer questions. It fetches the guidelines listed in `sources.json`, converts
each one to markdown, and saves the results in one SQLite file. The chat agent only
reads that file and never fetches a source itself.

## How it works

`npx nx run reference-pipeline:build-library` runs [`src/cli.ts`](src/cli.ts),
which writes `data/references.db`.

1. `parseSources` ([sources.ts](src/lib/sources.ts)) checks each entry of
   `sources.json`. `Source` in that file says how to write an entry.
2. `buildReferenceLibrary` ([ingest.ts](src/lib/ingest.ts)) takes these steps
   for each source, one at a time.
   1. `createRateLimitedFetch` ([fetchBytes.ts](src/lib/fetchBytes.ts)) gives
      the fetch function for every request. For a `cdc-media` source,
      `fetchCdcMediaPage` ([cdcMedia.ts](src/lib/cdcMedia.ts)) calls CDC's
      content API.
   2. `htmlToBlocks` ([htmlToBlocks.ts](src/lib/htmlToBlocks.ts)) or
      `pdfToBlocks` ([pdfBlocks.ts](src/lib/pdfBlocks.ts)) turns the page or
      PDF into a list of blocks. A `Block` is one heading or one piece of text.
   3. `blocksToDocument` ([sections.ts](src/lib/sections.ts)) turns the blocks
      into one markdown document, its sections and their parts. A `Section` is
      a heading and its text. A `Part` is a piece of a section that the agent
      searches and reads.
3. `writeReference` ([referencesDb.ts](src/lib/referencesDb.ts)) stores each
   reference in the SQLite file.

The chat agent reads the library in four steps.

1. It searches titles and summaries in `documents_fts` to choose a reference.
2. It lists that reference's sections, which act as its outline.
3. It searches that reference's parts in `parts_fts`, filtered by
   `document_id`, to find the parts that mention a term.
4. It reads one part by its `document_id`, `section_id` and part number.

The docblock of each exported function and type says what it does, why it
exists and where the library stores it.
