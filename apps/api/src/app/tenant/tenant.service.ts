import { Injectable } from '@nestjs/common';
import {
  CernerDSTU2TenantEndpoints,
  DSTU2Endpoint as CernerDSTU2Endpoint,
  CernerR4TenantEndpoints,
  R4Endpoint as CernerR4Endpoint,
} from '@mere/cerner';
import {
  EpicDSTU2TenantEndpoints,
  DSTU2Endpoint as EpicDSTU2Endpoint,
} from '@mere/epic';
import {
  VeradigmDSTU2TenantEndpoints,
  DSTU2Endpoint as VeradigmDSTU2Endpoint,
} from '@mere/veradigm';

type UnifiedTenantEndpoint = {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
  vendor: 'EPIC' | 'CERNER' | 'VERADIGM';
  version: 'DSTU2' | 'R4';
};

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

const searchR4Items: UnifiedTenantEndpoint[] = (
  [] as UnifiedTenantEndpoint[]
).concat(
  (CernerR4TenantEndpoints as unknown as UnifiedTenantEndpoint[]).map((i) => {
    i.vendor = 'CERNER';
    i.version = 'R4';
    return i;
  }),
);

@Injectable()
export class TenantService {
  private readonly dstu2Items = searchDSTU2Items;
  private readonly r4Items = searchR4Items;
  private readonly allItems = [...searchDSTU2Items, ...searchR4Items];

  async queryTenants(
    query: string,
    vendors: string[],
  ): Promise<UnifiedTenantEndpoint[]> {
    return filteredItemsWithQuery(this.dstu2Items, query, vendors);
  }

  async queryR4Tenants(
    query: string,
    vendors: string[],
  ): Promise<UnifiedTenantEndpoint[]> {
    return filteredItemsWithQuery(this.r4Items, query, vendors);
  }

  async queryAllTenants(
    query: string,
    vendors: string[],
  ): Promise<UnifiedTenantEndpoint[]> {
    return filteredItemsWithQuery(this.allItems, query, vendors);
  }
}

function filteredItemsWithQuery(
  items: UnifiedTenantEndpoint[],
  query: string,
  vendors?: string[] | string,
): UnifiedTenantEndpoint[] {
  if (vendors && vendors.length) {
    const vendorArray = Array.isArray(vendors) ? vendors : [vendors];
    items = items.filter((item) => vendorArray.includes(item.vendor));
  }
  if (query === '' || query === undefined) {
    return items.sort((x, y) => (x.name > y.name ? 1 : -1)).slice(0, 100);
  }
  return items
    .map((item) => {
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
