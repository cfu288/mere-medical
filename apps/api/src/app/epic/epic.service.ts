import { Injectable } from '@nestjs/common';
import { EpicDSTU2TenantEndpoints, DSTU2Endpoint } from '@mere/epic';
import { stringSimilarity } from '@mere/shared';

@Injectable()
export class EpicService {
  private readonly items = EpicDSTU2TenantEndpoints;

  async queryTenants(query: string): Promise<DSTU2Endpoint[]> {
    return filteredItemsWithQuery(this.items, query);
  }
}

function filteredItemsWithQuery(items: DSTU2Endpoint[], query: string) {
  if (query === '' || query === undefined) {
    return items.sort((x, y) => x.name.localeCompare(y.name)).slice(0, 100);
  }
  return items
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
