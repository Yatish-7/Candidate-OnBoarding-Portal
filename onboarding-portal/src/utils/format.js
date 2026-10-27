import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

// Adds dayjs().fromNow(), used by formatRelative below
dayjs.extend(relativeTime)

// The backend sends ISO dates ("2026-10-23" or "2026-10-23T14:30:00"). These make them readable.

// "2 days ago"
export function formatRelative(value) {
  return value ? dayjs(value).fromNow() : '—'
}

// "23 Oct 2026"
export function formatDate(value) {
  return value ? dayjs(value).format('DD MMM YYYY') : '—'
}

// "23 Oct 2026, 2:30 PM"
export function formatDateTime(value) {
  return value ? dayjs(value).format('DD MMM YYYY, h:mm A') : '—'
}

// Bill rate after the optional discount price: bill rate - discount price (null when there is no
// discount or no bill rate). Same rule as the backend (Candidate.getDiscountedBillRate).
export function discountedBillRate(billRate, discountPrice) {
  if (billRate == null || billRate === '' || discountPrice == null || discountPrice === '') return null
  const bill = Number(billRate)
  const off = Number(discountPrice)
  if (Number.isNaN(bill) || Number.isNaN(off)) return null
  return Math.round((bill - off) * 100) / 100
}

// Vendor percentage = pay rate / bill rate x 100 (two decimals); with a discount the discounted
// bill rate is used. Same rule as the backend (Candidate.getVendorPercentage); "—" when a rate is
// missing or the bill rate is 0.
export function formatVendorPercentage(payRate, billRate, discountPrice) {
  const pay = Number(payRate)
  const bill = Number(discountedBillRate(billRate, discountPrice) ?? billRate)
  if (payRate == null || billRate == null || payRate === '' || billRate === '' || !bill || Number.isNaN(pay)) {
    return '—'
  }
  return `${((pay * 100) / bill).toFixed(2)}%`
}

// 85 → "$85.00 / hr"
export function formatRate(value) {
  return value === null || value === undefined ? '—' : `$${Number(value).toFixed(2)} / hr`
}

// "123-45-6789" → "***-**-6789". Only the last 4 digits are ever shown.
export function maskSsn(ssn) {
  if (!ssn) return '—'
  const lastFour = ssn.replace(/\D/g, '').slice(-4)
  return `***-**-${lastFour}`
}
