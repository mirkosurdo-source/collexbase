import Stripe from "stripe"

/**
 * Lazily-initialised server-side Stripe client.
 *
 * The key is read from STRIPE_SECRET_KEY. We do NOT throw at import time so the
 * rest of the app keeps working when Stripe is not yet configured; instead each
 * route calls `getStripe()` and surfaces a clear error if the key is missing.
 */
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error("STRIPE_NOT_CONFIGURED")
  }
  _stripe = new Stripe(key, {
    appInfo: { name: "CollexBase", version: "1.0.0" },
    typescript: true,
  })
  return _stripe
}

/** True when the server Stripe key is present. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** The publishable key exposed to the client for Stripe Elements. */
export function getPublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || ""
}

/**
 * Normalises any thrown value into a friendly message. STRIPE_NOT_CONFIGURED is
 * mapped to a localized, user-facing string.
 */
export function stripeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === "STRIPE_NOT_CONFIGURED") {
      return "I pagamenti non sono ancora configurati. Aggiungi STRIPE_SECRET_KEY per abilitarli."
    }
    return err.message
  }
  return "Errore di pagamento sconosciuto."
}
