/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { CernerDSTU2TenantEndpoints } from '@mere/cerner';
import { EpicDSTU2TenantEndpoints } from '@mere/epic';
import { VeradigmDSTU2TenantEndpoints } from '@mere/veradigm';
import { HealowR4TenantEndpoints } from '@mere/healow';

export interface TenantEndpoint {
  id: string;
  url: string;
  name: string;
  token?: string;
  authorize?: string;
}

type UnifiedDSTU2TenantEndpoint = TenantEndpoint & {
  vendor: 'EPIC' | 'CERNER' | 'VERADIGM' | 'HEALOW';
};

type UnifiedTenantEndpoint = UnifiedDSTU2TenantEndpoint & {
  version: 'DSTU2' | 'R4';
};

const searchR4Items: UnifiedTenantEndpoint[] = (
  [] as UnifiedTenantEndpoint[]
).concat(
  (HealowR4TenantEndpoints as unknown as UnifiedTenantEndpoint[]).map((i) => {
    i.vendor = 'HEALOW';
    i.version = 'R4';
    return i;
  }),
);

const searchDSTU2Items: UnifiedTenantEndpoint[] = (
  [] as UnifiedTenantEndpoint[]
)
  .concat(
    (EpicDSTU2TenantEndpoints as unknown as UnifiedTenantEndpoint[]).map(
      (i) => {
        i.vendor = 'EPIC';
        i.version = 'DSTU2';
        return i;
      },
    ),
  )
  .concat(
    (CernerDSTU2TenantEndpoints as unknown as UnifiedTenantEndpoint[]).map(
      (i) => {
        i.vendor = 'CERNER';
        i.version = 'DSTU2';
        return i;
      },
    ),
  )
  .concat(
    (VeradigmDSTU2TenantEndpoints as unknown as UnifiedTenantEndpoint[]).map(
      (i) => {
        i.vendor = 'VERADIGM';
        i.version = 'DSTU2';
        return i;
      },
    ),
  );

@Injectable()
export class TenantService {
  private readonly DSTU2Items = searchDSTU2Items;
  private readonly R4Items = searchR4Items;

  async queryDSTU2Tenants(
    query: string,
    vendors: string[],
  ): Promise<UnifiedDSTU2TenantEndpoint[]> {
    return filteredItemsWithQuery(this.DSTU2Items, query, vendors);
  }

  async queryR4Tenants(
    query: string,
    vendors: string[],
  ): Promise<UnifiedTenantEndpoint[]> {
    return filteredItemsWithQuery(this.R4Items, query, vendors);
  }

  async queryTenants(
    query: string,
    vendors: string[],
  ): Promise<UnifiedTenantEndpoint[]> {
    return filteredItemsWithQuery(
      this.DSTU2Items.concat(this.R4Items),
      query,
      vendors,
    );
  }
}

function filteredItemsWithQuery(
  items: UnifiedTenantEndpoint[],
  query: string,
  vendors?: string[] | string,
) {
  if (vendors && vendors.length) {
    items = items.filter((item) => [...vendors].includes(item.vendor));
  }
  if (query === '' || query === undefined) {
    return items.sort((x, y) => (x.name > y.name ? 1 : -1)).slice(0, 100);
  }
  return items
    .map((item) => {
      // Match against each token, take highest score
      const vals = item.name
        ?.split(' ')
        .map((token) => stringSimilarity(token, query));
      const rating = vals ? Math.max(...vals) : 0;
      return { rating, item };
    })
    ?.filter((item) => item.rating > 0.05)
    ?.sort((a, b) => b.rating - a.rating)
    ?.slice(0, 50)
    ?.map((item) => item.item);
}

/**
 * Compares the similarity between two strings using an n-gram comparison method.
 * The grams default to length 2.
 * @param str1 The first string to compare.
 * @param str2 The second string to compare.
 * @param gramSize The size of the grams. Defaults to length 2.
 */
export function stringSimilarity(str1: string, str2: string, gramSize = 2) {
  if (!str1?.length || !str2?.length) {
    return 0.0;
  }

  //Order the strings by length so the order they're passed in doesn't matter
  //and so the smaller string's ngrams are always the ones in the set
  const s1 = str1.length < str2.length ? str1 : str2;
  const s2 = str1.length < str2.length ? str2 : str1;

  const pairs1 = getNGrams(s1, gramSize);
  const pairs2 = getNGrams(s2, gramSize);
  const set = new Set<string>(pairs1);

  const total = pairs2.length;
  let hits = 0;
  for (const item of pairs2) {
    if (set.delete(item)) {
      hits++;
    }
  }
  return hits / total;
}

function getNGrams(s: string, len: number) {
  s = ' '.repeat(len - 1) + s.toLowerCase() + ' '.repeat(len - 1);
  const v = new Array(s.length - len + 1);
  for (let i = 0; i < v.length; i++) {
    v[i] = s.slice(i, i + len);
  }
  return v;
}
