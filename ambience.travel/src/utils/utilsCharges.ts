// utilsCharges.ts - single-source grouping of booking charge lines into the
// display buckets used across OutlookTab, guest subpages, and PDFs. The category
// -> bucket mapping lives here ONCE; no surface re-derives it.
//
// Buckets:
//   govTax   - VAT and government/statutory taxes
//   localTax - city, tourist, and environmental taxes (the per-person-night kind)
//   fees     - resort and service fees (non-commissionable, client pays)
//
// Only non-rate-inclusive charges are summed (inclusive ones are already inside
// the base rate, so counting them would double). Amounts are native currency;
// pass the USD variant by reading amountUsd upstream if a USD total is needed.

export type ChargeLine = {
  chargeCategory:  string
  amount:          number
  amountUsd?:      number | null
  isRateInclusive: boolean
}

export type ChargeGroups = {
  govTax:   number
  localTax: number
  fees:     number
  total:    number
}

const GOV_TAX   = new Set(['vat', 'government_tax'])
const LOCAL_TAX = new Set(['city_tax', 'tourist_tax', 'environmental_tax'])
const FEES      = new Set(['resort_fee', 'service_charge'])

// Group charge lines into gov tax / local tax / fees. `useUsd` selects the USD
// column when true, else native amount. Rate-inclusive lines are skipped (already
// in the base). Uncategorized/other lines fall through to neither bucket but still
// count toward total (they affect what the client pays).
export function groupCharges(charges: ChargeLine[], useUsd = false): ChargeGroups {
  let govTax = 0
  let localTax = 0
  let fees = 0
  let total = 0
  for (const c of charges) {
    if (c.isRateInclusive) continue
    const amt = useUsd ? (c.amountUsd ?? 0) : c.amount
    total += amt
    if (GOV_TAX.has(c.chargeCategory))   { govTax += amt; continue }
    if (LOCAL_TAX.has(c.chargeCategory)) { localTax += amt; continue }
    if (FEES.has(c.chargeCategory))      { fees += amt; continue }
  }
  return {
    govTax:   Math.round(govTax * 100) / 100,
    localTax: Math.round(localTax * 100) / 100,
    fees:     Math.round(fees * 100) / 100,
    total:    Math.round(total * 100) / 100,
  }
}