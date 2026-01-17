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
  EpicR4TenantEndpoints,
  R4Endpoint as EpicR4Endpoint,
} from '@mere/epic';
import {
  VeradigmDSTU2TenantEndpoints,
  DSTU2Endpoint as VeradigmDSTU2Endpoint,
} from '@mere/veradigm';
import { stringSimilarity } from '@mere/shared';

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

// TODO: Add Healow R4 endpoints to searchR4Items so they appear in unified search.
// Healow currently has its own /api/v1/healow/tenants endpoint but is excluded from
// the combined "Search All" results.
const searchR4Items: UnifiedTenantEndpoint[] = ([] as UnifiedTenantEndpoint[])
  .concat(
    (EpicR4TenantEndpoints as unknown as UnifiedTenantEndpoint[]).map((i) => {
      i.vendor = 'EPIC';
      i.version = 'R4';
      return i;
    }),
  )
  .concat(
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
    return items.sort((x, y) => x.name.localeCompare(y.name)).slice(0, 100);
  }
  return items
    .map((item) => {
      const vals = item.name
        ?.split(' ')
        .map((token) => stringSimilarity(token, query));
      const rating = vals ? Math.max(...vals) : 0;
      return { rating, item };
    })
    .filter((item) => item.rating > 0.05)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 50)
    .map((item) => item.item);
}
