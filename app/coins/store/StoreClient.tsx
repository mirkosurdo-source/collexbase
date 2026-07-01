"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import CollexSpark from "@/components/collexspark/CollexSpark"

interface PricedPackage {
  id: string
  coins: number
  realValue: number
  storePrice: number
  baseDiscountPct: number
  tierDiscountPct: number
  finalPrice: number
  savings: number
  totalDiscountPct: number
  tier: "Base" | "Gold" | "Premium"
}

interface PackagesResp {
  success: boolean
  coinValueEur: number
  tier: "Base" | "Gold" | "Premium"
  packages: PricedPackage[]
}

const eur = (v: number) => v.toLocaleString("it-IT", { style: "currency", currency: "EUR" })
const num = (v: number) => v.toLocaleString("it-IT")

/** Highlight the package with the deepest total discount as "Miglior valore". */
function bestValueId(packages: PricedPackage[]): string | null {
  if (!packages.length) return null
  return packages.reduce((best, p) => (p.totalDiscountPct > best.totalDiscountPct ? p : best), packages[0]).id
}

export default function StoreClient() {
  const router = useRouter()
  const params = useSearchParams()

  const [data, setData] = useState<PackagesResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [buying, setBuying] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<{ coins: number; savings: number; tier: string } | null>(null)

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null)

  const loadPackages = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/coins/packages", {
        headers: { Authorization: `Bearer ${token() || ""}` },
      })
      const json: PackagesResp = await res.json()
      if (json.success) setData(json)
      else setError("Impossibile caricare i pacchetti.")
    } catch {
      setError("Errore di connessione.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Confirm a returning Stripe checkout (success_url carries session_id).
  const confirmSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch("/api/coins/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token() || ""}` },
          body: JSON.stringify({ sessionId }),
        })
        const json = await res.json()
        if (json.success) {
          setCelebration({ coins: json.coins, savings: json.savings || 0, tier: json.tier || "Base" })
        }
      } catch {
        // Silent — the webhook-free confirm can be retried by reloading.
      } finally {
        router.replace("/coins/store")
      }
    },
    [router],
  )

  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  useEffect(() => {
    const sessionId = params.get("session_id")
    if (sessionId) confirmSession(sessionId)
  }, [params, confirmSession])

  async function buy(pkg: PricedPackage) {
    if (!token()) {
      router.push("/login?redirect=/coins/store")
      return
    }
    setBuying(pkg.id)
    try {
      const res = await fetch("/api/coins/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token() || ""}` },
        body: JSON.stringify({ packageId: pkg.id }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
        return
      }
      if (json.credited) {
        setCelebration({ coins: json.coins, savings: json.savings || 0, tier: pkg.tier })
        loadPackages()
      } else {
        setError(json.message || "Acquisto non riuscito.")
      }
    } catch {
      setError("Errore durante l'avvio del pagamento.")
    } finally {
      setBuying(null)
    }
  }

  const tier = data?.tier || "Base"
  const best = data ? bestValueId(data.packages) : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <header className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CollexSpark pose="deal" size="lg" still />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance">Store CollexCoins</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ricarica il tuo wallet.{" "}
              <span className="font-medium text-foreground">1 CollexCoin = € 0,05</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tier !== "Base" && (
            <span className="inline-flex items-center rounded-full bg-spark/10 px-3 py-1 text-xs font-semibold text-spark">
              Sconto {tier} attivo
            </span>
          )}
          <Link
            href="/wallet"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Il mio wallet
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Packages */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          Caricamento pacchetti…
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.packages.map((pkg) => {
            const isBest = pkg.id === best
            const hasDiscount = pkg.totalDiscountPct > 0
            return (
              <div
                key={pkg.id}
                className={`group relative flex flex-col rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md ${
                  isBest ? "border-spark ring-1 ring-spark/40" : "border-border"
                }`}
              >
                {isBest && (
                  <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-spark px-3 py-1 text-xs font-semibold text-spark-foreground">
                    Miglior valore
                  </span>
                )}

                {/* Coins amount */}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground">{num(pkg.coins)}</span>
                  <span className="text-sm font-medium text-muted-foreground">CollexCoins</span>
                </div>

                {/* Real value tooltip */}
                <div className="group/tip relative mt-1 inline-flex w-fit cursor-help items-center gap-1 text-xs text-muted-foreground">
                  <span className="underline decoration-dotted underline-offset-2">Valore reale</span>
                  <span className="invisible absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover/tip:visible">
                    1 CollexCoin = € 0,05
                  </span>
                </div>

                {/* Pricing */}
                <div className="mt-4 flex items-end gap-2">
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">{eur(pkg.realValue)}</span>
                  )}
                  <span className="text-2xl font-semibold text-foreground">{eur(pkg.finalPrice)}</span>
                </div>

                {/* Discount + savings */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {hasDiscount && (
                    <span className="inline-flex items-center rounded-full bg-spark/10 px-2 py-0.5 text-xs font-semibold text-spark">
                      -{pkg.totalDiscountPct}%
                    </span>
                  )}
                  {pkg.savings > 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Risparmi {eur(pkg.savings)}
                    </span>
                  )}
                  {pkg.tierDiscountPct > 0 && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      incl. bonus {pkg.tier}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => buy(pkg)}
                  disabled={buying === pkg.id}
                  className="mt-6 inline-flex items-center justify-center rounded-lg bg-spark px-4 py-2.5 text-sm font-semibold text-spark-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {buying === pkg.id ? "Avvio…" : "Acquista ora"}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* FAQ */}
      <section className="mt-12 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Domande frequenti</h2>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-foreground">Quanto vale un CollexCoin?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Il valore ufficiale è di € 0,05 per ogni CollexCoin. I pacchetti più grandi offrono sconti maggiori.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Come funzionano gli sconti Gold/Premium?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Gli abbonati Gold ottengono un -5% extra e i Premium un -10% extra su ogni pacchetto, applicati
              automaticamente.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Quando ricevo le monete?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              L'accredito nel wallet è immediato al termine del pagamento sicuro tramite Stripe.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-foreground">Posso usarle subito?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Sì. Le monete sono disponibili nel tuo wallet e utilizzabili immediatamente nella piattaforma.
            </dd>
          </div>
        </dl>
      </section>

      {/* CollexSpark celebration */}
      {celebration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setCelebration(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center">
              <CollexSpark pose="happy" size="xl" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-foreground text-balance">
              Hai acquistato {num(celebration.coins)} CollexCoins!
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Monete aggiunte al tuo wallet.
              {celebration.savings > 0 && <> Risparmio totale: {eur(celebration.savings)}.</>}
              {celebration.tier !== "Base" && <> Bonus {celebration.tier} applicato!</>}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href="/wallet"
                className="rounded-lg bg-spark px-4 py-2 text-sm font-semibold text-spark-foreground hover:opacity-90"
              >
                Vai al wallet
              </Link>
              <button
                type="button"
                onClick={() => setCelebration(null)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Continua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
