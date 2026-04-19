/**
 * In-memory TTL cache for filter dropdown API responses (per company).
 * Invalidated when underlying data changes (shifts, roles, etc.).
 */
const DEFAULT_TTL_MS = Number(process.env.FILTER_CACHE_TTL_MS) || 60_000;
const DEFAULT_MAX_KEYS = Number(process.env.FILTER_CACHE_MAX_KEYS) || 3000;

function companyPrefix(companyId) {
  return `c:${String(companyId)}:`;
}

class FilterResponseCache {
  constructor({ ttlMs = DEFAULT_TTL_MS, maxKeys = DEFAULT_MAX_KEYS } = {}) {
    this.ttlMs = ttlMs;
    this.maxKeys = maxKeys;
    /** @type {Map<string, { value: unknown; expiresAt: number }>} */
    this.store = new Map();
  }

  makeKey(namespace, companyId, payload) {
    const body =
      payload && typeof payload === 'object'
        ? JSON.stringify(payload, Object.keys(payload).sort())
        : String(payload);
    return `${companyPrefix(companyId)}${namespace}:${body}`;
  }

  get(key) {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key, value) {
    while (this.store.size >= this.maxKeys) {
      const first = this.store.keys().next().value;
      if (first === undefined) break;
      this.store.delete(first);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidateByPrefix(prefix) {
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  /** Shift-derived filters: distinct jobs / locations on shifts. */
  invalidateShiftFilters(companyId) {
    this.invalidateByPrefix(`${companyPrefix(companyId)}shiftFilters:`);
  }

  /** Company roles dropdown (paged). */
  invalidateCompanyRoleFilters(companyId) {
    this.invalidateByPrefix(`${companyPrefix(companyId)}companyFilters:roles:`);
  }
}

module.exports = {
  filterResponseCache: new FilterResponseCache(),
  companyPrefix,
};
