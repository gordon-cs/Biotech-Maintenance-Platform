type BillPaymentLinkSource = {
  id?: string | number
  invoiceId?: string | number
  billInvoiceId?: string | number
  bill_ar_invoice_id?: string | number | null
  paymentUrl?: string | null
  payment_url?: string | null
}

const PAYMENT_URL_KEYS = [
  'paymentUrl',
  'payment_url',
  'invoiceUrl',
  'invoice_url',
  'hostedPaymentUrl',
  'hosted_payment_url',
  'checkoutUrl',
  'checkout_url',
  'portalUrl',
  'portal_url',
  'payLink',
  'pay_link',
]

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
}

function findStringProperty(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  for (const key of keys) {
    const candidate = asString(record[key])
    if (candidate) {
      return candidate
    }
  }

  for (const nestedKey of ['response_data', 'responseData', 'data', 'invoice', 'result', 'payload']) {
    const nestedValue = record[nestedKey]
    if (nestedValue && typeof nestedValue === 'object') {
      const nestedCandidate = findStringProperty(nestedValue, keys)
      if (nestedCandidate) {
        return nestedCandidate
      }
    }
  }

  return null
}

function collectBillUrlCandidates(value: unknown, seen = new Set<unknown>()): string[] {
  if (!value || typeof value !== 'object') {
    return []
  }

  if (seen.has(value)) {
    return []
  }
  seen.add(value)

  const record = value as Record<string, unknown>
  const candidates: string[] = []

  for (const fieldValue of Object.values(record)) {
    if (typeof fieldValue === 'string') {
      candidates.push(fieldValue)
      continue
    }

    if (Array.isArray(fieldValue)) {
      for (const item of fieldValue) {
        if (typeof item === 'string') {
          candidates.push(item)
        } else if (item && typeof item === 'object') {
          candidates.push(...collectBillUrlCandidates(item, seen))
        }
      }
      continue
    }

    if (fieldValue && typeof fieldValue === 'object') {
      candidates.push(...collectBillUrlCandidates(fieldValue, seen))
    }
  }

  return candidates
}

function isBillPaymentUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate)
    const isBillHost = parsed.hostname === 'bill.com' || parsed.hostname.endsWith('.bill.com')
    if (parsed.protocol !== 'https:' || !isBillHost) {
      return false
    }

    // Never use Bill generic error routes as payment URLs.
    if (parsed.pathname.includes('/app/arp/generic-error/')) {
      return false
    }

    // Tokenized /p/... links from email are preferred and safe to open.
    if (parsed.pathname.startsWith('/p/')) {
      return true
    }

    // Guest session deep links are only considered usable when they carry signed context.
    if (parsed.pathname.includes('/app/arp/guest/session/pay/')) {
      const hasSignedQuery =
        parsed.searchParams.has('token') ||
        parsed.searchParams.has('emailenc') ||
        parsed.searchParams.has('directLogin')
      return hasSignedQuery
    }

    return true
  } catch {
    return false
  }
}

export function resolveBillPaymentUrl(source: BillPaymentLinkSource | null | undefined): string | null {
  const directUrl = findStringProperty(source, PAYMENT_URL_KEYS)
  if (directUrl && isBillPaymentUrl(directUrl)) {
    return directUrl
  }

  // Bill.com may return hosted payment links under variable key names.
  const deepCandidates = collectBillUrlCandidates(source)
  const guestPaymentUrl = deepCandidates.find(
    (candidate) => isBillPaymentUrl(candidate) && candidate.includes('/guest/session/pay/')
  )
  if (guestPaymentUrl) {
    return guestPaymentUrl
  }

  const anyBillUrl = deepCandidates.find((candidate) => isBillPaymentUrl(candidate))
  if (anyBillUrl) {
    return anyBillUrl
  }

  return null
}
