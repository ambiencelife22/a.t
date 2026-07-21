// Snake_case to camelCase key transform for wire payloads. The EF reads snake
// from the DB and emits frontend-ready camelCase; the frontend never transforms.
// Recursive: descends into nested objects and arrays. Already-camel keys pass
// through unchanged (no underscore, no change), so mixed-shape inputs are safe.
// Generic by construction, so new fields convert automatically with no drift.

function toCamel(key: string): string {
  if (key.startsWith('_')) return key
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

export function camelizeKeys<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map(v => camelizeKeys(v)) as unknown as T
  }
  if (input !== null && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[toCamel(k)] = camelizeKeys(v)
    }
    return out as T
  }
  return input as T
}

// Compile-time twin of camelizeKeys: transforms an object type's keys
// snake_case to camelCase, recursing into nested objects and arrays. Derives
// the wire (camelCase) shape from the one snake-source type, so the runtime
// transform and the type can never drift. TimelineItemView = CamelizeKeys<TimelineItem>.

type SnakeToCamel<S extends string> =
  S extends `${infer H}_${infer T}`
    ? `${H}${Capitalize<SnakeToCamel<T>>}`
    : S

export type CamelizeKeys<T> =
  T extends readonly (infer U)[]
    ? CamelizeKeys<U>[]
    : T extends object
      ? { [K in keyof T as SnakeToCamel<K & string>]: CamelizeKeys<T[K]> }
      : T
// camelCase to snake_case key transform for WRITE payloads. The inverse of
// camelizeKeys: the frontend authors camelCase, and at the single write
// boundary the payload is snakeized to the DB's snake columns / the EF's snake
// contract. Recursive over nested objects and arrays. Already-snake keys pass
// through unchanged. Generic by construction, so new fields convert with no drift.
function toSnake(key: string): string {
  return key.replace(/[A-Z0-9]+/g, m => '_' + m.toLowerCase())
}
export function snakeizeKeys<T = unknown>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map(v => snakeizeKeys(v)) as unknown as T
  }
  if (input !== null && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[toSnake(k)] = snakeizeKeys(v)
    }
    return out as T
  }
  return input as T
}
