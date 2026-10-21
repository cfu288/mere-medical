# reference-pipeline

This code builds the clinical reference library that the chat agent uses to
answer questions. It fetches the guidelines listed in `sources.json`, converts
each one to markdown, and saves the results in one SQLite file. The chat agent
only reads that file and never fetches a source itself.

## How it works

`npx nx run reference-pipeline:build-library` runs [`src/cli.ts`](src/cli.ts),
which writes `data/references.db`.

1. `parseSources` ([sources.ts](src/lib/sources.ts)) checks each entry of
   `sources.json`. The `Source` docblock in `sources.ts` says how to write an
   entry.
2. `buildReferenceLibrary` ([ingest.ts](src/lib/ingest.ts)) takes these steps
   for each source, one at a time.
   1. `createRateLimitedFetch` ([fetchBytes.ts](src/lib/fetchBytes.ts)) gives
      the fetch function for every request. For a `cdc-media` source,
      `fetchCdcMediaPage` ([cdcMedia.ts](src/lib/cdcMedia.ts)) calls CDC's
      content API.
   2. `htmlToBlocks` ([htmlToBlocks.ts](src/lib/htmlToBlocks.ts)) or
      `pdfToBlocks` ([pdfBlocks.ts](src/lib/pdfBlocks.ts)) turns the page or
      PDF into a list of blocks.
   3. `blocksToDocument` ([sections.ts](src/lib/sections.ts)) turns the blocks
      into one markdown document, its sections and their chunks.
3. `writeReference` ([referencesDb.ts](src/lib/referencesDb.ts)) stores each
   reference in the SQLite file.

The chat agent reads the library through the API server's
[`ReferenceController`](../../apps/api/src/app/reference/reference.controller.ts),
which calls the functions in [query.ts](src/lib/query.ts). It takes four steps.

1. `searchReferences` searches titles and summaries to choose a reference.
2. `getOutline` lists that reference's sections.
3. `findInReference` finds that reference's chunks that mention a term.
4. `readChunk` reads one chunk of a section.

The API server serves these routes only when `REFERENCE_DB_PATH` names a
library file. `parseReferenceLibraryConfig` reads that setting. When the file is
not a valid library, the API server does not start.
