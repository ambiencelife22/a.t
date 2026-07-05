/* utils/utilsDates.ts
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
 *
 * Last updated: S53 — Two new formatters added:
 *   formatMonthYear   — "May 2026"    — guide accuracy disclaimers
 *   formatDateLong    — "01 July 2026" — general app DD Month YYYY
 * Both follow the UTC-safe parse pattern established in S23.
 */

const MONTHS = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
]

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]
const DAYS_OF_WEEK_SHORT = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
]

// ── Canonical formatter ──────────────────────────────────────────────────────
// Accepts YYYY-MM-DD (optionally followed by a time component — stripped).
// Returns "25 April 2026".
// Returns the input unchanged if it doesn't match the YYYY-MM-DD prefix.

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day   = parseInt(m[3], 10)
  return `${day} ${MONTHS[month]} ${year}`
}

export function formatDateWeekday(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day   = parseInt(m[3], 10)
  const d = new Date(year, month, day)
  return `${DAYS_OF_WEEK[d.getDay()]}, ${day} ${MONTHS[month]} ${year}`
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = start ? start.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!a) return end ? formatDate(end) : ''
  const b = end ? end.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!b) return formatDate(start)
  const ay = parseInt(a[1], 10), am = parseInt(a[2], 10) - 1, ad = parseInt(a[3], 10)
  const by = parseInt(b[1], 10), bm = parseInt(b[2], 10) - 1, bd = parseInt(b[3], 10)
  if (am === bm && ay === by) return `${ad}-${bd} ${MONTHS[am]} ${ay}`
  return `${ad} ${MONTHS[am]} ${ay} - ${bd} ${MONTHS[bm]} ${by}`
}

export function formatDateRangeWeekday(start: string | null | undefined, end: string | null | undefined): string {
  const a = start ? start.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!a) return end ? formatDateWeekday(end) : ''
  const b = end ? end.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!b) return formatDateWeekday(start)
  const ay = parseInt(a[1], 10), am = parseInt(a[2], 10) - 1, ad = parseInt(a[3], 10)
  const by = parseInt(b[1], 10), bm = parseInt(b[2], 10) - 1, bd = parseInt(b[3], 10)
  const wa = DAYS_OF_WEEK[new Date(ay, am, ad).getDay()]
  const wb = DAYS_OF_WEEK[new Date(by, bm, bd).getDay()]
  if (am === bm && ay === by) return `${wa} ${ad} - ${wb} ${bd} ${MONTHS[am]} ${ay}`
  return `${wa} ${ad} ${MONTHS[am]} ${ay} - ${wb} ${bd} ${MONTHS[bm]} ${by}`
}

// ── Short form ───────────────────────────────────────────────────────────────
// Returns "25 Apr 2026" — for compact contexts like admin list views.

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day   = parseInt(m[3], 10)
  return `${day}${MONTHS_SHORT[month]}${String(year).slice(-2)}`
}

export function formatDateShortWeekday(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  const day   = parseInt(m[3], 10)
  const d = new Date(year, month, day)
  return `${DAYS_OF_WEEK_SHORT[d.getDay()]}, ${day}${MONTHS_SHORT[month]}${String(year).slice(-2)}`
}

export function formatDateShortRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = start ? start.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!a) return end ? formatDateShort(end) : ''
  const b = end ? end.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!b) return formatDateShort(start)
  const ay = parseInt(a[1], 10), am = parseInt(a[2], 10) - 1, ad = parseInt(a[3], 10)
  const by = parseInt(b[1], 10), bm = parseInt(b[2], 10) - 1, bd = parseInt(b[3], 10)
  if (am === bm && ay === by) return `${ad}-${bd}${MONTHS_SHORT[am]}${String(ay).slice(-2)}`
  return `${formatDateShort(start)} - ${formatDateShort(end)}`
}

// ── Month + year ─────────────────────────────────────────────────────────────
// Returns "May 2026" — used in guide accuracy disclaimers where a precise day
// is not meaningful; the month of currency is the relevant signal.
// First-of-month ISO values (2026-05-01) render as "May 2026".

export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  return `${MONTHS[month]} ${year}`
}

// ── Month+year short — "Jan 2027" ────────────────────────────────────────────
export function formatMonthYearShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const year  = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  return `${MONTHS_SHORT[month]} ${year}`
}
// ── Date short upper — "03 JAN 2027" ─────────────────────────────────────────
// Zero-padded day, uppercase short month, 4-digit year.
// Used for accuracy_date display and houseUi date badges.
export function formatDateShortUpper(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const day   = parseInt(m[3], 10).toString().padStart(2, '0')
  const month = MONTHS_SHORT[parseInt(m[2], 10) - 1].toUpperCase()
  const year  = m[1]
  return `${day} ${month} ${year}`
}
// ── Month upper — "JAN" ───────────────────────────────────────────────────────
// Uppercase 3-letter month only. Used in PDF welcome letter date badge.
export function formatMonthUpper(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return MONTHS_SHORT[parseInt(m[2], 10) - 1].toUpperCase()
}
// ── DateTime — "5 Jan 2027 · 15:45" ──────────────────────────────────────────
// ISO timestamp → canonical date + time. Uses 24h fmtTime for consistency.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const datePart = iso.slice(0, 10)
  const timePart = iso.slice(11, 16)
  const date = formatDateShort(datePart)
  if (!timePart || timePart === '00:00') return date
  return `${date} · ${fmtTime(timePart)}`
}
// ── Month+day short — "Jan 5" ─────────────────────────────────────────────────
// Short month + day, no year. Used for message timestamps.
export function formatMonthDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${MONTHS_SHORT[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}`
}
// ── Today — local browser date ────────────────────────────────────────────────
// Returns YYYY-MM-DD in the user's local timezone. Safe for comparing against
// Postgres date columns (which are also date-only, no tz component).
// DEBT P2: destination-aware date requires global_destinations.timezone (IANA)
// + Intl.DateTimeFormat lookup. Currently uses browser local time — acceptable
// since guests are typically in or traveling to the destination.

export function localDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Time formatter ───────────────────────────────────────────────────────────
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