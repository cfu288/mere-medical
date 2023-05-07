import { Injectable } from '@nestjs/common';
import {
  CernerDSTU2TenantEndpoints,
  DSTU2Endpoint as CernerDSTU2Endpoint,
} from '@mere/cerner';
import {
  EpicDSTU2TenantEndpoints,
  DSTU2Endpoint as EpicDSTU2Endpoint,
} from '@mere/epic';
import {
  VeradigmDSTU2TenantEndpoints,
  DSTU2Endpoint as VeradigmDSTU2Endpoint,
} from '@mere/veradigm';

type DSTU2Endpoint = CernerDSTU2Endpoint &
  EpicDSTU2Endpoint &
  VeradigmDSTU2Endpoint & { vendor: 'EPIC' | 'CERNER' | 'VERADIGM' };

const searchItems = []
  .concat(
    (EpicDSTU2TenantEndpoints as unknown as DSTU2Endpoint[]).map((i) => {
      i.vendor = 'EPIC';
      return i;
    })
  )
  .concat(
    (CernerDSTU2TenantEndpoints as unknown as DSTU2Endpoint[]).map((i) => {
      i.vendor = 'CERNER';
      return i;
    })
  )
  .concat(
    (VeradigmDSTU2TenantEndpoints as unknown as DSTU2Endpoint[]).map((i) => {
      i.vendor = 'VERADIGM';
      return i;
    })
  );

@Injectable()
export class TenantService {
  private readonly items = searchItems;

  async queryTenants(query: string): Promise<DSTU2Endpoint[]> {
    return filteredItemsWithQuery(this.items, query);
  }
}

function filteredItemsWithQuery(items: DSTU2Endpoint[], query: string) {
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
