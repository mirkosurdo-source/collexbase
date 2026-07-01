"use client"

import { use, useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { loadStripe } from "@stripe/stripe-js"
import { Elements } from "@stripe/react-stripe-js"
import CheckoutForm from "@/components/payments/CheckoutForm"
import { formatEUR } from "@/lib/format"

interface Breakdown {
  amount: number
  buyerFee: number
  sellerFee: number
  buyerTotal: number
  sellerNet: number
  buyerFeePct: number
  sellerFeePct: number
}

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [itemName, setItemName] = useState("")
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [escrowId, setEscrowId] = useState("")
  const [testMode, setTestMode] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    async function start() {
      try {
        const res = await fetch("/api/payments/marketplace/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ listingId: id }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "Impossibile avviare il pagamento.")
          return
        }
        setBreakdown(data.breakdown)
        setEscrowId(data.escrowId)
        if (data.configured && data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setTestMode(true)
        }
        // Fetch listing name for display.
        const lres = await fetch(`/api/market/item?id=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (lres.ok) {
          const ldata = await lres.json()
          setItemName(ldata.listing?.itemName || ldata.item?.itemName || "Oggetto")
        }
      } catch {
        setError("Errore di rete. Riprova.")
      } finally {
        setLoading(false)
      }
    }
    start()
  }, [id, router])

  async function handleTestConfirm() {
    const token = localStorage.getItem("token")
    const res = await fetch("/api/payments/marketplace/test-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ escrowId }),
    })
    if (!res.ok) throw new Error("confirm failed")
    router.push("/payments")
  }

  const elementsOptions = useMemo(
    () => (clientSecret ? { clientSecret, appearance: { theme: "stripe" as const } } : undefined),
    [clientSecret],
  )

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Pagamento sicuro</h1>
        <Link href="/payments" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          Annulla
        </Link>
      </div>

      {loading && <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && breakdown && (
        <div className="grid gap-6">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Riepilogo
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600 dark:text-neutral-400">Prezzo articolo</dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-50">{formatEUR(breakdown.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600 dark:text-neutral-400">
                  {`Commissione acquirente (${breakdown.buyerFeePct}%)`}
                </dt>
                <dd className="font-medium text-neutral-900 dark:text-neutral-50">{formatEUR(breakdown.buyerFee)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <dt className="font-semibold text-neutral-900 dark:text-neutral-50">Totale</dt>
                <dd className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  {formatEUR(breakdown.buyerTotal)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            {testMode ? (
              <CheckoutForm
                itemName={itemName}
                buyerTotal={breakdown.buyerTotal}
                testMode
                onTestConfirm={handleTestConfirm}
              />
            ) : clientSecret && stripePromise && elementsOptions ? (
              <Elements stripe={stripePromise} options={elementsOptions}>
                <CheckoutForm
                  itemName={itemName}
                  buyerTotal={breakdown.buyerTotal}
                  testMode={false}
                  onTestConfirm={handleTestConfirm}
                />
              </Elements>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Inizializzazione del modulo di pagamento...
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
