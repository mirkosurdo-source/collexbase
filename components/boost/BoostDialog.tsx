"use client"

import { useEffect, useState } from "react"
import type { BoostTargetType, BoostTier } from "@/lib/models/BoostActivation"

interface Quote {
  targetType: BoostTargetType
  tier: BoostTier
  listPrice: number
  discountPct: number
  finalPrice: number
  savings: number
  effect: { label: string; visibilityPct: number; durationHours: number; callout: boolean }
}

const TARGET_LABEL: Record<BoostTargetType, string> = {
  marketplace: "annuncio",
  auction: "asta",
  trade: "scambio",
  showcase: "vetrina",
}

function durationLabel(hours: number): string {
  if (hours >= 24) return `${Math.round(hours / 24)} giorni`
  return `${hours}h`
}

export default function BoostDialog({
  open,
  onClose,
  targetType,
  targetId,
  onActivated,
}: {
  open: boolean
  onClose: () => void
  targetType: BoostTargetType
  targetId?: string
  onActivated?: () => void
}) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [balance, setBalance] = useState(0)
  const [plan, setPlan] = useState<string>("Base")
  const [selected, setSelected] = useState<BoostTier>("plus")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setError("")
    setDone(false)
    setLoading(true)
    const token = localStorage.getItem("token")
    fetch("/api/boost/active", { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setQuotes(d.quotes?.[targetType] || [])
          setBalance(d.balance || 0)
          setPlan(d.plan || "Base")
        }
      })
      .catch(() => setError("Impossibile caricare i prezzi."))
      .finally(() => setLoading(false))
  }, [open, targetType])

  if (!open) return null

  const current = quotes.find((q) => q.tier === selected)
  const insufficient = current ? balance < current.finalPrice : false

  async function activate() {
    if (!current) return
    setSubmitting(true)
    setError("")
    try {
      const token = localStorage.getItem("token")
      const res = await fetch("/api/boost/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ targetType, targetId, tier: selected }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.message || "Attivazione non riuscita.")
        return
      }
      setBalance(data.balance ?? balance)
      setDone(true)
      onActivated?.()
    } catch {
      setError("Errore di rete.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Attiva un boost"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-neutral-50">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-amber-500" aria-hidden="true">
              <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" />
            </svg>
            Potenzia {TARGET_LABEL[targetType]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" />
                </svg>
              </div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-50">Boost attivato!</p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Saldo rimanente: {balance.toLocaleString("it-IT")} CollexCoins
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                Chiudi
              </button>
            </div>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-neutral-500">Caricamento prezzi…</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
                Saldo: <span className="font-semibold text-neutral-900 dark:text-neutral-50">{balance.toLocaleString("it-IT")}</span> CollexCoins
                {plan !== "Base" && (
                  <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    Sconto {plan}
                  </span>
                )}
              </p>

              <div className="space-y-2">
                {quotes.map((q) => {
                  const active = q.tier === selected
                  return (
                    <button
                      key={q.tier}
                      type="button"
                      onClick={() => setSelected(q.tier)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                          : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-neutral-50">{q.effect.label}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          +{q.effect.visibilityPct}% visibilità · {durationLabel(q.effect.durationHours)}
                          {q.effect.callout ? " · top + callout" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-neutral-900 dark:text-neutral-50">{q.finalPrice} CC</p>
                        {q.discountPct > 0 && (
                          <p className="text-xs text-neutral-400 line-through">{q.listPrice} CC</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
              {insufficient && !error && (
                <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                  Saldo insufficiente. <a href="/wallet/coins" className="underline">Acquista CollexCoins</a>.
                </p>
              )}

              <button
                type="button"
                onClick={activate}
                disabled={submitting || insufficient || !current}
                className="mt-4 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Attivazione…" : current ? `Attiva per ${current.finalPrice} CollexCoins` : "Attiva"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
