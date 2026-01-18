import { Injectable } from '@nestjs/common';
import { HealowR4TenantEndpoints, R4Endpoint } from '@mere/healow';
import { stringSimilarity } from '@mere/shared';

@Injectable()
export class HealowService {
  private readonly r4Items = HealowR4TenantEndpoints;

  async queryR4Tenants(query: string): Promise<R4Endpoint[]> {
    return filteredItemsWithQuery(this.r4Items, query);
  }

  findTenantById(tenantId: string): R4Endpoint | undefined {
    return this.r4Items.find((t) => t.id === tenantId);
  }
}

function filteredItemsWithQuery<T extends { name: string }>(
  items: T[],
  query: string,
): T[] {
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
