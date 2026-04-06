type BillPaymentLinkSource = {
  id?: string | number
  invoiceId?: string | number
  billInvoiceId?: string | number
  bill_ar_invoice_id?: string | number
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
  'url',
]

const ID_KEYS = ['bill_ar_invoice_id', 'billInvoiceId', 'invoiceId', 'id']

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

function applyTemplate(template: string, invoiceId: string): string {
  return template
    .replace(/\{\{\s*(?:invoiceId|billInvoiceId)\s*\}\}/gi, invoiceId)
    .replace(/:invoiceId\b/gi, invoiceId)
}

export function resolveBillPaymentUrl(source: BillPaymentLinkSource | null | undefined): string | null {
  const directUrl = findStringProperty(source, PAYMENT_URL_KEYS)
  if (directUrl) {
    return directUrl
  }

  const invoiceId = findStringProperty(source, ID_KEYS)
  const template = process.env.BILL_PAYMENT_URL_TEMPLATE?.trim()

  if (template && invoiceId) {
    return applyTemplate(template, invoiceId)
  }

  return null
}
