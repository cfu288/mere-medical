import { DatabaseSync } from 'node:sqlite';
import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  Found,
  findInReference,
  getOutline,
  listReferences,
  readChunk,
  searchReferences,
} from '@mere/reference-pipeline';

/**
 * The reference library routes the chat agent calls. Each route calls one
 * function from `@mere/reference-pipeline`, whose docblock describes the
 * result. An unknown id answers 404 with `{ error }`.
 */
@Controller('v1/agent/references')
export class ReferenceController {
  constructor(private readonly db: DatabaseSync) {}

  @Get()
  list(@Res() response: Response, @Query('page') page?: string) {
    try {
      response.json(listReferences(this.db, Number(page)));
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('search')
  search(
    @Res() response: Response,
    @Query('q') q?: string | string[],
    @Query('page') page?: string,
  ) {
    try {
      response.json(searchReferences(this.db, terms(q), Number(page)));
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get([':id/outline', ':id/outline/:sectionId'])
  outline(
    @Res() response: Response,
    @Param('id') id: string,
    @Param('sectionId') sectionId?: string,
  ) {
    try {
      lookup(response, getOutline(this.db, id, sectionId));
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get(':id/sections/:sectionId/chunks/:chunk')
  chunk(
    @Res() response: Response,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('chunk') chunk: string,
  ) {
    try {
      lookup(response, readChunk(this.db, id, sectionId, Number(chunk)));
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get(':id/find')
  find(
    @Res() response: Response,
    @Param('id') id: string,
    @Query('q') q?: string | string[],
  ) {
    try {
      lookup(response, findInReference(this.db, id, terms(q)));
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}

function lookup<T>(
  response: Response,
  result: Found<T> | { kind: 'no-reference' | 'no-section' | 'no-chunk' },
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
