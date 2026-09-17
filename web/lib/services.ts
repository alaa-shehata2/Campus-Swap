import { createIdentityService } from '../../src/identity/service.js';
import { createListingsService } from '../../src/listings/service.js';
import { MySqlIdentityStore, MySqlListingsStore } from './db/repositories';
import { db } from './db';

/**
 * Per-request domain services backed by MySQL (ADR-0002).
 * Pool is a singleton; stores are cheap wrappers created per request.
 */
export function services() {
  const pool = db();
  return {
    identity: createIdentityService(new MySqlIdentityStore(pool)),
    listings: createListingsService(new MySqlListingsStore(pool)),
  };
}

export type Services = ReturnType<typeof services>;
