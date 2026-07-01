"use client"

import { useState } from "react"
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js"
import { formatEUR } from "@/lib/format"

interface CheckoutFormProps {
  itemName: string
  buyerTotal: number
  testMode: boolean
  onTestConfirm: () => Promise<void>
}

export default function CheckoutForm({ itemName, buyerTotal, testMode, onTestConfirm }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    // Test mode: no Stripe keys configured, confirm the escrow server-side.
    if (testMode) {
      try {
        await onTestConfirm()
      } catch {
        setError("Conferma non riuscita. Riprova.")
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!stripe || !elements) {
      setSubmitting(false)
      return
    }

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/payments` },
    })

    if (stripeError) {
      setError(stripeError.message || "Pagamento non riuscito.")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {testMode ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          Stripe non è configurato in questo ambiente. Procedendo, il pagamento verrà simulato e i fondi verranno
          messi in escrow per il venditore.
        </div>
      ) : (
        <PaymentElement />
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || (!testMode && !stripe)}
        className="flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {submitting ? "Elaborazione..." : `Paga ${formatEUR(buyerTotal)}`}
      </button>

      <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        {`Pagamento protetto per "${itemName}". I fondi sono trattenuti in escrow fino alla conferma di consegna.`}
      </p>
    </form>
  )
}
