// Deno test — resolvePublicGuestLabel precedence + person-gate (HPGL, S53M).
// Run: deno test supabase/functions/_shared/names.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { resolvePublicGuestLabel } from './names.ts'

// tier 1 — override wins over everything
Deno.test('override wins', () => {
  assertEquals(
    resolvePublicGuestLabel('Override Name', 'Family Label', true, 'Nick', 'First', 'House Public'),
    'Override Name',
  )
})

// tier 1 — whitespace override falls through (''-means-hide)
Deno.test('whitespace override falls through to label', () => {
  assertEquals(
    resolvePublicGuestLabel('   ', 'Family Label', true, 'Nick', 'First', 'House Public'),
    'Family Label',
  )
})

// tier 2 — selected label wins over person and house
Deno.test('label wins over person and house', () => {
  assertEquals(
    resolvePublicGuestLabel(null, 'AlSuwaidi Family', true, 'Nick', 'First', 'House Public'),
    'AlSuwaidi Family',
  )
})

// tier 3 — person present, nickname wins
Deno.test('person tier: nickname', () => {
  assertEquals(
    resolvePublicGuestLabel(null, null, true, 'Mo', 'Mohammed', 'House Public'),
    'Mo',
  )
})

// tier 3 — person present, no nickname -> first_name
Deno.test('person tier: first_name when no nickname', () => {
  assertEquals(
    resolvePublicGuestLabel(null, null, true, null, 'Mohammed', 'House Public'),
    'Mohammed',
  )
})

// DELEGATION GUARD — person present but nameless -> null, NEVER house
Deno.test('person present but no nick/first -> null, not house', () => {
  assertEquals(
    resolvePublicGuestLabel(null, null, true, null, null, 'House Public'),
    null,
  )
})

// tier 4 — no person -> house public name
Deno.test('no person -> house public name', () => {
  assertEquals(
    resolvePublicGuestLabel(null, null, false, 'Nick', 'First', 'Alsuwaidi Travel Party'),
    'Alsuwaidi Travel Party',
  )
})

// DELEGATION GUARD — no person, empty house -> null, NEVER person
Deno.test('no person, empty house -> null, never person leak', () => {
  assertEquals(
    resolvePublicGuestLabel(null, null, false, 'Nick', 'First', null),
    null,
  )
})

// full null -> null
Deno.test('nothing resolves -> null', () => {
  assertEquals(
    resolvePublicGuestLabel(null, null, false, null, null, null),
    null,
  )
})

// Austria as-is: person set, no label, no override, nickname null -> "Mohammed"
Deno.test('Austria current state resolves to Mohammed via person tier', () => {
  assertEquals(
    resolvePublicGuestLabel(null, null, true, null, 'Mohammed', null),
    'Mohammed',
  )
})
