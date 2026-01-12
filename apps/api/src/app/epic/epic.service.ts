import { Injectable } from '@nestjs/common';
import {
  EpicDSTU2TenantEndpoints,
  DSTU2Endpoint,
  EpicR4TenantEndpoints,
  R4Endpoint,
} from '@mere/epic';
import { stringSimilarity } from '@mere/shared';

const SANDBOX_IDS = ['sandbox_epic', 'sandbox_epic_r4'];

@Injectable()
export class EpicService {
  private readonly items = EpicDSTU2TenantEndpoints;
  private readonly r4Items = EpicR4TenantEndpoints;

  async queryTenants(
    query: string,
    sandboxOnly = false,
  ): Promise<DSTU2Endpoint[]> {
    const items = sandboxOnly
      ? this.items.filter((item) => SANDBOX_IDS.includes(item.id))
      : this.items;
    return filteredItemsWithQuery(items, query);
  }

  async queryR4Tenants(
    query: string,
    sandboxOnly = false,
  ): Promise<R4Endpoint[]> {
    const items = sandboxOnly
      ? this.r4Items.filter((item) => SANDBOX_IDS.includes(item.id))
      : this.r4Items;
    return filteredItemsWithQuery(items, query);
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
