/* utils/utilsCurrency.ts
 * Canonical currency formatting for ambience.travel - single source.
 *
 * Standing rule (S53M canon, locked with D - NO EXCEPTIONS):
 *   - USD renders with a $ symbol behind a word prefix:  "USD $12,000"
 *   - EUR renders as the word "EURO" with NO symbol:      "EURO 12,000"
 *   - Every other currency renders as its ISO code prefix, NO symbol:
 *       GBP -> "GBP 800"   CHF -> "CHF 5,400"   AED -> "AED 44,000"
 *   - Thousands separators always. No inline `$` concatenation anywhere,
 *     no Intl currency-symbol rendering (Intl is used only for grouping).
 *
 * TWO REGISTERS (mirror of utilsDates long/short):
 *   money(n, ccy)     WHOLE     - summaries, pipeline, dashboards.  "USD $12,000"
 *   moneyDec(n, ccy)  DECIMAL   - line items, commission, receipts. "USD $12,000.64"
 *
 * Created S53M. Extracted after a currency-formatting audit found inline
 * Intl.NumberFormat copies + a hand-built `$`-concat across four files
 * (OutlookTab usd/usdDec, StudioDashboard usd, EngagementDossierSection, TimeAnalyticsTab).
 */

// Currency -> display prefix. USD is the only symbol-bearer; EUR is the one
// word-special-cased currency; all others fall through to their ISO code.
const CURRENCY_PREFIX: Record<string, string> = {
  USD: 'USD $',
  EUR: 'EURO ',
}

function prefixFor(ccy: string | null | undefined): string {
  const code = (ccy ?? 'USD').toUpperCase()
  return CURRENCY_PREFIX[code] ?? `${code} `
}

// Grouped digits only - Intl handles thousands separators, never the symbol.
function grouped(n: number, minFrac: number, maxFrac: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  }).format(n)
}

// ── WHOLE - summaries ──────────────────────────────────────────────────────────
// "USD $12,000" · "EURO 12,000" · "GBP 800"
export function money(n: number | null | undefined, ccy: string | null | undefined = 'USD'): string {
  if (n == null || Number.isNaN(n)) return ''
  return `${prefixFor(ccy)}${grouped(n, 0, 0)}`
}

// ── DECIMAL - line items ────────────────────────────────────────────────────────
// "USD $12,000.64" · "EURO 12,000.50" · "GBP 800.00"
export function moneyDec(n: number | null | undefined, ccy: string | null | undefined = 'USD'): string {
  if (n == null || Number.isNaN(n)) return ''
  return `${prefixFor(ccy)}${grouped(n, 2, 2)}`
}