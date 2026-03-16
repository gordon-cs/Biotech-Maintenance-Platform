const enabledValue = process.env.NEXT_PUBLIC_ENABLE_PAYMENTS?.toLowerCase()

export const PAYMENTS_ENABLED = enabledValue === "true" || enabledValue === "1" || enabledValue === "yes"
