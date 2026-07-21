// utilsSearch.ts - Canonical search/filter helper for ambience admin surfaces.
//
// Single source for all query-based filtering. Replaces scattered inline
// .toLowerCase().includes(q) patterns across admin tabs.
//
// Usage:
//   matchesQuery(query, field1, field2, field3)
//   → true if ANY field contains the query (case-insensitive, null-safe)
//   → true when query is empty (show all)
//
// Never inline .toLowerCase().includes() on user search queries. Always use this.

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  if (!query) return true
  const q = query.toLowerCase().trim()
  if (!q) return true
  return fields.some(f => (f ?? '').toLowerCase().includes(q))
}
