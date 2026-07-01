"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface SellerProfile {
  totalPayout: number
  totalSales: number
  totalOrders: number
  stripe: {
    connected: boolean
    chargesEnabled: boolean
    payoutsEnabled: boolean
    detailsSubmitted: boolean
  }
}

const eur = (n: number) => `€ ${(n || 0).toFixed(2)}`

export default function SellerDashboardPage() {
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      window.location.href = "/login"
      return
    }
    fetch("/api/seller/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProfile(data.profile)
        else setError(data.message || "Errore nel caricamento del profilo.")
      })
      .catch(() => setError("Errore di rete."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-muted-foreground">Caricamento...</p>
      </main>
    )
  }

  const connected = profile?.stripe.connected ?? false
  const payoutsEnabled = profile?.stripe.payoutsEnabled ?? false

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard Venditore</h1>
      <p className="mt-1 text-muted-foreground">Pagamenti, payout e stato del collegamento Stripe.</p>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && !profile && (
        <div className="mt-6 rounded-lg border border-border bg-card p-6 text-card-foreground">
          <p className="text-muted-foreground">
            Non hai ancora un profilo venditore. Collega Stripe per iniziare a vendere.
          </p>
          <Link
            href="/seller/connect"
            className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Collega Stripe
          </Link>
        </div>
      )}

      {profile && (
        <>
          {/* Stripe connection status */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">Account Stripe</h2>
                <p className="mt-1 text-lg font-semibold text-card-foreground">
                  {connected ? (payoutsEnabled ? "Collegato e attivo" : "Collegato — onboarding incompleto") : "Non collegato"}
                </p>
              </div>
              <span
                className={`inline-flex h-3 w-3 rounded-full ${
                  connected && payoutsEnabled ? "bg-green-500" : connected ? "bg-amber-500" : "bg-muted-foreground/40"
                }`}
                aria-hidden="true"
              />
            </div>
            {(!connected || !payoutsEnabled) && (
              <Link
                href="/seller/connect"
                className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {connected ? "Completa onboarding" : "Collega Stripe"}
              </Link>
            )}
          </section>

          {/* Payout aggregates */}
          <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payout totali</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-card-foreground">{eur(profile.totalPayout)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendite totali</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-card-foreground">{eur(profile.totalSales)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordini completati</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-card-foreground">{profile.totalOrders}</p>
            </div>
          </section>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            I pagamenti delle vendite restano in deposito protetto per 48 ore. Una volta che l&apos;acquirente conferma
            la ricezione — o allo scadere delle 48 ore — i fondi vengono trasferiti automaticamente al tuo account
            Stripe.
          </p>
        </>
      )}
    </main>
  )
}
