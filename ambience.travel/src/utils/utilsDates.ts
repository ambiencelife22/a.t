/* lib/dates.ts
 * Shared date formatting helpers for ambience.travel.
 * Canonical date rendering across the travel app.
 *
 * Standing rule (S23 canon):
 * — All dates render as DD Month YYYY (e.g. "25 April 2026")
 * — Date-only ISO strings (YYYY-MM-DD) MUST route through formatDateOnly()
 * — Never pass a YYYY-MM-DD string to `new Date(iso).toLocaleDateString()`:
 *   `new Date('2026-04-25')` parses as UTC midnight, then .toLocaleDateString()
 *   renders in local time — users west of UTC see -1 day.
 *
 * Month names are hardcoded rather than locale-derived so output is stable
 * across environments and independent of any future i18n work.
 *
 * Created S23. Extracted from PropertyIntroSection.tsx after a date-only
 * rendering audit found six Postgres date columns consumed across three files.
 */

const MONTHS = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
]

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

// ── Canonical formatter ──────────────────────────────────────────────────────
// Accepts YYYY-MM-DD (optionally followed by a time component — stripped).
// Returns "25 April 2026".
// Returns the input unchanged if it doesn't match the YYYY-MM-DD prefix.

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day   = parseInt(m[3], 10)
  return `${day} ${MONTHS[month]} ${year}`
}

// ── With weekday ─────────────────────────────────────────────────────────────
// Returns "Saturday, 25 April 2026" — used on day-level journey pages.

export function formatDateWithWeekday(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day   = parseInt(m[3], 10)
  const d = new Date(year, month, day)
  return `${DAYS_OF_WEEK[d.getDay()]}, ${day} ${MONTHS[month]} ${year}`
}

// ── Short form ───────────────────────────────────────────────────────────────
// Returns "25 Apr 2026" — for compact contexts like admin list views.

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day   = parseInt(m[3], 10)
  return `${day} ${MONTHS_SHORT[month]} ${year}`
}

// "15:05" -> "15:05 (pm)", "08:40" -> "08:40 (am)", "00:30" -> "00:30 (am)".
// 24-hour clock with am/pm period in parens (am: hour < 12, pm: hour >= 12;
// midnight is am, noon is pm). Single source for time display across every
// surface — admin editors, client page, all PDFs.
export function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const period = hour < 12 ? 'am' : 'pm'
  return `${h.padStart(2, '0')}:${m} (${period})`
}