import { DatabaseSync } from 'node:sqlite';
import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  Found,
  findInReference,
  getOutline,
  listReferences,
  readSection,
  searchReferences,
} from '@mere/reference-pipeline';

@Controller('v1/agent/references')
export class ReferenceController {
  constructor(private readonly db: DatabaseSync) {}

  @Get()
  list(@Res() response: Response, @Query('page') page?: string) {
    respond(response, () =>
      response.json(listReferences(this.db, Number(page))),
    );
  }

  @Get('search')
  search(
    @Res() response: Response,
    @Query('q') q?: string | string[],
    @Query('page') page?: string,
  ) {
    respond(response, () =>
      response.json(searchReferences(this.db, terms(q), Number(page))),
    );
  }

  @Get([':id/outline', ':id/outline/:sectionId'])
  outline(
    @Res() response: Response,
    @Param('id') id: string,
    @Param('sectionId') sectionId?: string,
  ) {
    respond(response, () =>
      lookup(response, getOutline(this.db, id, sectionId)),
    );
  }

  @Get(':id/sections/:sectionId')
  section(
    @Res() response: Response,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
  ) {
    respond(response, () =>
      lookup(response, readSection(this.db, id, sectionId)),
    );
  }

  @Get(':id/find')
  find(
    @Res() response: Response,
    @Param('id') id: string,
    @Query('q') q?: string | string[],
  ) {
    respond(response, () =>
      lookup(response, findInReference(this.db, id, terms(q))),
    );
  }
}

function respond(response: Response, handle: () => void) {
  try {
    handle();
  } catch (e) {
    Logger.error(e);
    response.status(500).send({ message: 'There was an error' });
  }
}

function lookup<T>(
  response: Response,
  result: Found<T> | { kind: 'no-reference' | 'no-section' },
) {
  if (result.kind === 'found') {
    response.json(result.value);
  } else {
    response.status(404).json({ error: result.kind });
  }
}

function terms(q: string | string[] | undefined): string[] {
  return Array.isArray(q) ? q : q ? [q] : [];
}
