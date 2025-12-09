import { Injectable } from '@nestjs/common';
import { VeradigmDSTU2TenantEndpoints, DSTU2Endpoint } from '@mere/veradigm';
import { stringSimilarity } from '@mere/shared';

@Injectable()
export class VeradigmService {
  private readonly items = VeradigmDSTU2TenantEndpoints;

  async queryTenants(query: string): Promise<DSTU2Endpoint[]> {
    return filteredItemsWithQuery(this.items, query);
  }
}

function filteredItemsWithQuery(items: DSTU2Endpoint[], query: string) {
  if (query === '' || query === undefined) {
    return items
      .filter(
        (item) =>
          !!item.name?.trim() &&
          !!item.authorize?.trim() &&
          !!item.token?.trim(),
      )
      .sort((x, y) => x.name.localeCompare(y.name))
      .slice(0, 100);
  }
  return items
    .filter(
      (item) =>
        !!item.name?.trim() && !!item.authorize?.trim() && !!item.token?.trim(),
    )
    .map((item) => {
      const vals = item.name
        .split(' ')
        .map((token) => stringSimilarity(token, query));
      const rating = Math.max(...vals);
      return { rating, item };
    })
    .filter((item) => item.rating > 0.05)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 50)
    .map((item) => item.item);
}
