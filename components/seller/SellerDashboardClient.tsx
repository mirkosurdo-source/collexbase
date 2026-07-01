"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AdminAreaChart, AdminBarChart, StatusPill } from "@/components/admin/shared"
import {
  fmtDate,
  fmtEUR,
  fmtNum,
  sellerPost,
  type SellerOrderDTO,
  type SellerProfileDTO,
} from "@/components/seller/shared"

interface DashboardData {
  success: boolean
  message?: string
  profile: SellerProfileDTO
  charts: { sales: { label: string; value: number }[]; orders: { label: string; value: number }[] }
  inventory: { total: number; published: number }
  payouts: { available: number; pending: number }
  recentOrders: SellerOrderDTO[]
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function SellerDashboardClient() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [forbidden, setForbidden] = useState(false)
  const [onboarding, setOnboarding] = useState(false)

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetch("/api/seller/dashboard", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      if (res.status === 403) {
        setForbidden(true)
        setLoading(false)
        return
      }
      const json = (await res.json()) as DashboardData
      if (!json.success) setError(json.message || "Errore di caricamento.")
      else setData(json)
    } catch {
      setError("Errore di connessione.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function startOnboarding() {
    setOnboarding(true)
    try {
      const res = await sellerPost<{ success: boolean; url?: string; message?: string }>(
        "/api/seller/stripe/onboard",
        {},
      )
      if (res.success && res.url) window.location.href = res.url
      else setError(res.message || "Impossibile avviare l'onboarding Stripe.")
    } catch {
      setError("Errore di connessione.")
    } finally {
      setOnboarding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
        Caricamento dashboard…
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Modalità Venditore non attiva</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          La modalità Venditore Professionista viene attivata dallo staff. Contatta il supporto per richiedere
          l&apos;attivazione del tuo account come venditore.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Torna alla dashboard
        </Link>
      </div>
    )
  }

  if (error && !data) {
    return <div className="rounded-xl border border-border bg-card p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
  }

  if (!data) return null

  const { profile, charts, inventory, payouts, recentOrders } = data
  const stripeReady = profile.stripe.connected && profile.stripe.chargesEnabled && profile.stripe.payoutsEnabled

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">Dashboard Venditore</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.username} · commissione {Math.round(profile.commissionRate * 100)}%
          </p>
        </div>
        <Link
          href="/seller/inventory"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Gestisci inventario
        </Link>
      </header>

      {!stripeReady && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Completa la configurazione dei pagamenti</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              Collega il tuo account Stripe per ricevere i pagamenti dei tuoi ordini.
            </p>
          </div>
          <button
            type="button"
            onClick={startOnboarding}
            disabled={onboarding}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {onboarding ? "Attendi…" : profile.stripe.connected ? "Continua onboarding" : "Collega Stripe"}
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vendite totali" value={fmtEUR(profile.totalSales)} hint={`${fmtNum(profile.totalOrders)} ordini`} />
        <Stat label="Payout disponibile" value={fmtEUR(payouts.available)} hint={`${fmtEUR(payouts.pending)} in sospeso`} />
        <Stat label="Commissioni pagate" value={fmtEUR(profile.totalCommission)} />
        <Stat
          label="Rating"
          value={profile.ratingCount > 0 ? profile.rating.toFixed(1) : "—"}
          hint={`${fmtNum(profile.ratingCount)} recensioni`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Vendite (30 giorni)</p>
          <AdminAreaChart data={charts.sales} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Ordini (30 giorni)</p>
          <AdminBarChart data={charts.orders.map((d) => ({ category: d.label, value: d.value }))} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Stat label="Articoli in inventario" value={fmtNum(inventory.total)} hint={`${fmtNum(inventory.published)} pubblicati`} />
        <Stat label="Payout totale ricevuto" value={fmtEUR(profile.totalPayout)} />
        <Stat label="Stato Stripe" value={stripeReady ? "Operativo" : profile.stripe.connected ? "In verifica" : "Da collegare"} />
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">Ordini recenti</h2>
          <Link href="/seller/orders" className="text-xs text-primary hover:underline">
            Vedi tutti
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nessun ordine ancora.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {o.items.map((i) => i.title).join(", ") || "Ordine"}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{fmtEUR(o.total)}</span>
                  <StatusPill status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
