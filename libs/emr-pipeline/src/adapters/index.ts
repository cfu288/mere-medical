import type { Vendor } from '@mere/shared';
import { athenaAdapter } from './athena';
import { cernerAdapter } from './cerner';
import { epicAdapter } from './epic';
import { healowAdapter } from './healow';
import { veradigmAdapter } from './veradigm';
import type { VendorAdapter } from './types';

export const ADAPTERS: Record<Vendor, VendorAdapter> = {
  epic: epicAdapter,
  cerner: cernerAdapter,
  veradigm: veradigmAdapter,
  healow: healowAdapter,
  athena: athenaAdapter,
};

export function adapterFor(vendor: Vendor): VendorAdapter {
  return ADAPTERS[vendor];
}
