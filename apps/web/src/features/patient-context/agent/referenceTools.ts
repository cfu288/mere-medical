import { isAbortError } from './abort';
import { AgentTool, ToolOutput, capLines, toTerms } from './tools';
import { REFERENCE_FETCH_TIMEOUT_MS } from '../constants';

type Location =
  | { kind: 'pages'; start: number; end: number }
  | { kind: 'webpage'; url?: string };

type ReferenceSummary = {
  id: string;
  title: string;
  edition: string;
  summary: string;
  url: string;
};

type ReferencePage = {
  references: ReferenceSummary[];
  total: number;
  page: number;
  pageSize: number;
};

type OutlineEntry = {
  sectionId: string;
  title: string;
  chars: number;
  location: Location;
};

type Outline = {
  reference: ReferenceSummary;
  section: OutlineEntry | null;
  sections: (OutlineEntry & {
    subsections: (OutlineEntry & { subsectionCount: number })[];
  })[];
};

type SectionRead = {
  reference: ReferenceSummary;
  section: {
    sectionId: string;
    title: string;
    location: Location;
    contentMd: string;
    subsections: OutlineEntry[];
  };
};

type Match = {
  sectionId: string;
  title: string;
  count: number;
  excerpt: string;
};

type NotFound = { error: 'no-reference' | 'no-section' };

export const UNAVAILABLE = 'Reference material is unavailable right now.';
export const NO_SECTION_PREFIX = 'No section "';
const NEXT_FROM_OUTLINE =
  'Call read_section with a section id to read it, or get_outline with a section id to expand it.';

function boundedFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(REFERENCE_FETCH_TIMEOUT_MS);
  return fetch(url, {
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
  });
}

async function fetchJson<T>(
  url: string,
  signal: AbortSignal | undefined,
  notFound: (body: NotFound) => string,
  render: (body: T) => string | ToolOutput,
): Promise<string | ToolOutput> {
  try {
    const response = await boundedFetch(url, signal);
    if (response.status === 404) {
      return notFound((await response.json()) as NotFound);
    }
    if (!response.ok) {
      return UNAVAILABLE;
    }
    return render((await response.json()) as T);
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    return UNAVAILABLE;
  }
}

function idArg(value: unknown): string {
  return String(value ?? '').trim();
}

const referenceParam = {
  type: 'string',
  description: 'Reference id from search_references',
};

export function referenceTools(signal?: AbortSignal): AgentTool[] {
  const api = '/api/v1/agent/references';
  return [
    {
      def: {
        type: 'function',
        function: {
          name: 'search_references',
          description:
            'Search the published references on this server (clinical guidelines, USPSTF screening recommendations, CDC immunization schedules and health topics) by their titles and summaries. This is published guidance, not the personal record. Pass an array of synonyms and lay terms; results are ranked, 20 per page, with the total. Choose a reference from the results, then call get_outline.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                anyOf: [
                  { type: 'string' },
                  { type: 'array', items: { type: 'string' } },
                ],
              },
              page: { type: 'integer', description: 'Page number, from 1' },
            },
            required: ['query'],
          },
        },
      },
      run: (args) => {
        const terms = toTerms(args['query']);
        if (terms.length === 0) {
          return 'Pass query: an array of terms to look for.';
        }
        const query = terms.map((t) => `q=${encodeURIComponent(t)}`).join('&');
        return fetchJson<ReferencePage>(
          `${api}/search?${query}&page=${pageArg(args['page'])}`,
          signal,
          () => UNAVAILABLE,
          (page) =>
            page.total === 0
              ? `No references match ${terms.map((t) => `"${t}"`).join(', ')}. Try synonyms, lay terms, or single key words; if those find nothing either, the library does not cover this topic.`
              : renderPage(page, 'search_references'),
        );
      },
    },
    {
      def: {
        type: 'function',
        function: {
          name: 'list_references',
          description:
            'Browse every published reference on this server alphabetically by title, 50 per page, with the total. Prefer search_references; use this to browse when searching does not find what you need.',
          parameters: {
            type: 'object',
            properties: {
              page: { type: 'integer', description: 'Page number, from 1' },
            },
          },
        },
      },
      run: (args) =>
        fetchJson<ReferencePage>(
          `${api}?page=${pageArg(args['page'])}`,
          signal,
          () => UNAVAILABLE,
          (page) =>
            page.total === 0
              ? 'No reference material on file.'
              : renderPage(page, 'list_references'),
        ),
    },
    {
      def: {
        type: 'function',
        function: {
          name: 'get_outline',
          description:
            "Show a reference's sections two levels deep, with each section's id, size, and pages. Pass section to expand the sections under it.",
          parameters: {
            type: 'object',
            properties: {
              reference: referenceParam,
              section: {
                type: 'string',
                description: 'Optional section id to expand',
              },
            },
            required: ['reference'],
          },
        },
      },
      run: (args) => {
        const reference = idArg(args['reference']);
        const section = idArg(args['section']);
        if (!reference) {
          return 'Pass reference: an id from search_references.';
        }
        const url = section
          ? `${api}/${encodeURIComponent(reference)}/outline/${encodeURIComponent(section)}`
          : `${api}/${encodeURIComponent(reference)}/outline`;
        return fetchJson<Outline>(
          url,
          signal,
          (body) => notFoundMessage(body, reference, section),
          (outline) => renderOutline(outline, section),
        );
      },
    },
    {
      def: {
        type: 'function',
        function: {
          name: 'read_section',
          description:
            'Read one section of a reference by its id from get_outline. Returns the text with its citation and the ids of its subsections.',
          parameters: {
            type: 'object',
            properties: {
              reference: referenceParam,
              section: {
                type: 'string',
                description: 'Section id from get_outline',
              },
            },
            required: ['reference', 'section'],
          },
        },
      },
      run: (args) => {
        const reference = idArg(args['reference']);
        const section = idArg(args['section']);
        if (!reference) {
          return 'Pass reference: an id from search_references.';
        }
        if (!section) {
          return 'Pass section: an id from get_outline.';
        }
        return fetchJson<SectionRead>(
          `${api}/${encodeURIComponent(reference)}/sections/${encodeURIComponent(section)}`,
          signal,
          (body) => notFoundMessage(body, reference, section),
          renderSection,
        );
      },
    },
    {
      def: {
        type: 'function',
        function: {
          name: 'find_in_reference',
          description:
            'Find which sections of one reference mention any of the given terms. Returns section ids and match counts, not text; read a section with read_section. Pass an array of synonyms and lay terms.',
          parameters: {
            type: 'object',
            properties: {
              reference: referenceParam,
              query: {
                anyOf: [
                  { type: 'string' },
                  { type: 'array', items: { type: 'string' } },
                ],
              },
            },
            required: ['reference', 'query'],
          },
        },
      },
      run: (args) => {
        const reference = idArg(args['reference']);
        const terms = toTerms(args['query']);
        if (!reference) {
          return 'Pass reference: an id from search_references.';
        }
        if (terms.length === 0) {
          return 'Pass query: an array of terms to look for.';
        }
        const query = terms.map((t) => `q=${encodeURIComponent(t)}`).join('&');
        return fetchJson<{ matches: Match[] }>(
          `${api}/${encodeURIComponent(reference)}/find?${query}`,
          signal,
          (body) => notFoundMessage(body, reference, ''),
          ({ matches }) =>
            matches.length === 0
              ? `No sections of ${reference} match ${terms.map((t) => `"${t}"`).join(', ')}. Try other terms or call get_outline with reference "${reference}".`
              : capLines(
                  [
                    ...matches.map(
                      (m) =>
                        `${m.sectionId} | ${m.title} | ${m.count} ${m.count === 1 ? 'match' : 'matches'} | ${m.excerpt}`,
                    ),
                    'Call read_section with a section id to read it.',
                  ],
                  'narrow the terms',
                ),
        );
      },
    },
  ];
}

function notFoundMessage(
  body: NotFound,
  reference: string,
  section: string,
): string {
  return body.error === 'no-section'
    ? `${NO_SECTION_PREFIX}${section}" in ${reference}. Call get_outline with reference "${reference}" to see its sections.`
    : `No reference "${reference}". Call search_references to find one.`;
}

function renderOutline(outline: Outline, section: string): string {
  if (outline.sections.length === 0) {
    return `No subsections under "${section}". Call read_section with section "${section}" to read it.`;
  }
  const lines = [`${outline.reference.title} (${outline.reference.edition})`];
  const indent = outline.section ? '  ' : '';
  if (outline.section) {
    const pointer =
      outline.section.chars > 0
        ? ' | has its own text: read_section to read it'
        : '';
    lines.push(`${entryLine(outline.section, '')}${pointer}`);
  }
  for (const branch of outline.sections) {
    lines.push(entryLine(branch, indent));
    for (const leaf of branch.subsections) {
      const count =
        leaf.subsectionCount > 0
          ? ` | ${leaf.subsectionCount} subsections`
          : '';
      lines.push(`${entryLine(leaf, `${indent}  `)}${count}`);
    }
  }
  lines.push(NEXT_FROM_OUTLINE);
  return lines.join('\n');
}

function entryLine(entry: OutlineEntry, indent: string): string {
  const where = locationText(entry.location);
  return `${indent}${entry.sectionId} | ${entry.title} | ${entry.chars} chars${where ? ` | ${where}` : ''}`;
}

function renderSection(read: SectionRead): string | ToolOutput {
  const text = sectionText(read);
  return read.section.contentMd
    ? {
        text,
        retrieved: [
          {
            kind: 'section',
            reference: read.reference.id,
            section: read.section.sectionId,
          },
        ],
      }
    : text;
}

function sectionText({ reference, section }: SectionRead): string {
  const where = locationText(section.location);
  const cited =
    section.location.kind === 'webpage' && section.location.url
      ? section.location.url
      : reference.url;
  const lines = [
    `${reference.title} (${reference.edition}) > ${section.title}${where ? `, ${where}` : ''}`,
    cited,
    '',
    section.contentMd || '(No text of its own; read a subsection.)',
  ];
  if (section.subsections.length > 0) {
    lines.push(
      '',
      `Subsections: ${section.subsections
        .map((s) => `${s.sectionId} (${s.title}, ${s.chars} chars)`)
        .join('; ')}`,
    );
  }
  return lines.join('\n');
}

function locationText(location: Location): string {
  if (location.kind === 'webpage') {
    return '';
  }
  return location.start === location.end
    ? `p. ${location.start}`
    : `pp. ${location.start}-${location.end}`;
}

function pageArg(value: unknown): number {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

function renderPage(page: ReferencePage, tool: string): string {
  const lastPage = Math.ceil(page.total / page.pageSize);
  if (page.references.length === 0) {
    return `Page ${page.page} is past the last page (${lastPage}) of ${page.total} references.`;
  }
  const first = (page.page - 1) * page.pageSize + 1;
  const last = first + page.references.length - 1;
  const next =
    page.page < lastPage
      ? `Call ${tool} with page ${page.page + 1} for more, or get_outline with a reference id to see its sections.`
      : 'Call get_outline with a reference id to see its sections.';
  return [
    ...page.references.map(
      (r) => `${r.id} | ${r.title} | ${r.edition} | ${r.summary}`,
    ),
    `Showing ${first}-${last} of ${page.total} references. ${next}`,
  ].join('\n');
}
