"use client"

import { useState } from "react"

export default function SellerConnectPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function startOnboarding() {
    setError("")
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      window.location.href = "/login"
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/seller/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok && data.onboardingUrl) {
        window.location.href = data.onboardingUrl
      } else {
        setError(data.error || "Impossibile avviare il collegamento.")
        setLoading(false)
      }
    } catch {
      setError("Errore di rete. Riprova.")
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-12">
      <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-balance text-card-foreground">Collega il tuo account Stripe</h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Per ricevere i pagamenti delle tue vendite devi collegare un account Stripe. I fondi restano protetti in
          deposito per 48 ore e vengono trasferiti automaticamente al tuo conto.
        </p>

        <button
          onClick={startOnboarding}
          disabled={loading}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Reindirizzamento..." : "Inizia"}
        </button>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <p className="mt-6 text-xs text-muted-foreground">
          Verrai reindirizzato a Stripe per completare l&apos;onboarding in sicurezza.
        </p>
      </div>
    </main>
  )
}
