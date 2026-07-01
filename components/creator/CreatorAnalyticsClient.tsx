"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

/* ------------------------------- types -------------------------------- */
interface Overview {
  invitedUsers: number
  totalCommission: number
  totalRevenueGenerated: number
  totalDiscountsApplied: number
  premiumSales: number
  goldSales: number
}
interface DailyPoint {
  day: string
  commission: number
  revenue: number
  invitedUsers: number
  premiumSales: number
  goldSales: number
  discounts: number
}
interface Balance {
  available: number
  pending: number
  paid: number
}
interface PayoutRequest {
  id: string
  amount: number
  status: string
  destination: string
  stripeTransferId: string | null
  at: string
}
interface CommissionRow {
  userId: string
  amountSpent: number
  commissionAmount: number
  source: string
  at: string
}

const RANGES = [
  { label: "7 giorni", days: 7 },
  { label: "30 giorni", days: 30 },
  { label: "90 giorni", days: 90 },
]

/* ------------------------------- helpers ------------------------------- */
function eur(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0)
}
// Recharts v3 passes loosely-typed values to formatter/labelFormatter, so these
// wrappers accept `unknown` and coerce, keeping the chart props type-compatible.
function eurTip(v: unknown): string {
  return eur(Number(v) || 0)
}
function shortDay(iso: unknown): string {
  const parts = String(iso ?? "").split("-")
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : String(iso ?? "")
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
}

const STATUS_LABEL: Record<string, string> = {
  pending: "In attesa",
  approved: "Approvato",
  rejected: "Rifiutato",
  paid: "Pagato",
}

/* ------------------------------ component ------------------------------ */
export default function CreatorAnalyticsClient() {
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [notCreator, setNotCreator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [days, setDays] = useState(30)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [minPayout, setMinPayout] = useState(10)
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [commissions, setCommissions] = useState<CommissionRow[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [destination, setDestination] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    setToken(t)
    setChecked(true)
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const ovRes = await fetch(`/api/creator/analytics/overview?days=${days}`, { headers })
      if (ovRes.status === 403) {
        setNotCreator(true)
        return
      }
      const ovJson = await ovRes.json()
      if (!ovRes.ok || !ovJson.ok) throw new Error(ovJson.error || "Errore nel caricamento.")
      setOverview(ovJson.overview)

      const [dRes, bRes, pRes, cRes] = await Promise.all([
        fetch(`/api/creator/analytics/daily?days=${days}`, { headers }),
        fetch("/api/creator/payout/balance", { headers }),
        fetch("/api/creator/payout", { headers }),
        fetch("/api/creator/analytics/commissions", { headers }),
      ])
      const [dJson, bJson, pJson, cJson] = await Promise.all([dRes.json(), bRes.json(), pRes.json(), cRes.json()])
      if (dJson.ok) setDaily(dJson.series)
      if (bJson.ok) {
        setBalance(bJson.balance)
        setMinPayout(bJson.minPayout || 10)
      }
      if (pJson.ok) setPayouts(pJson.requests)
      if (cJson.ok) setCommissions(cJson.commissions)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto.")
    } finally {
      setLoading(false)
    }
  }, [token, days])

  useEffect(() => {
    if (checked && token) load()
    if (checked && !token) setLoading(false)
  }, [checked, token, load])

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Inserisci un importo valido.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/creator/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: value, destination: destination.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Errore nella richiesta.")
      setModalOpen(false)
      setAmount("")
      setDestination("")
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Errore sconosciuto.")
    } finally {
      setSubmitting(false)
    }
  }

  /* ------------------------------ states ------------------------------ */
  if (!checked || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Caricamento analytics…</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold">Analytics Creator</h1>
        <p className="mt-3 text-muted-foreground">Accedi per visualizzare la tua dashboard avanzata.</p>
        <a href="/login" className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground">
          Accedi
        </a>
      </div>
    )
  }

  if (notCreator) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold">Sei un Creator?</h1>
        <p className="mt-3 text-muted-foreground">
          Questa dashboard è riservata ai Creator Partner. Candidati per accedere ad analytics avanzati e payout.
        </p>
        <a href="/creator-apply" className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground">
          Diventa Creator
        </a>
      </div>
    )
  }

  const conversionData = [
    { name: "Premium", value: overview?.premiumSales || 0 },
    { name: "Gold", value: overview?.goldSales || 0 },
  ]

  return (
    <div className="mx-auto max-w-6xl py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Creator</h1>
          <p className="mt-1 text-muted-foreground">Andamento commissioni, revenue e utenti invitati.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/creator" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            Dashboard base
          </a>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Richiedi payout
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Time filters */}
      <div className="mt-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              days === r.days ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Balance cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BalanceCard label="Saldo disponibile" value={eur(balance?.available || 0)} accent />
        <BalanceCard label="In attesa di payout" value={eur(balance?.pending || 0)} />
        <BalanceCard label="Totale pagato" value={eur(balance?.paid || 0)} />
      </div>

      {/* Overview KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Commissioni" value={eur(overview?.totalCommission || 0)} />
        <Kpi label="Revenue generata" value={eur(overview?.totalRevenueGenerated || 0)} />
        <Kpi label="Utenti invitati" value={String(overview?.invitedUsers || 0)} />
        <Kpi label="Sconti applicati" value={eur(overview?.totalDiscountsApplied || 0)} />
      </div>

      {/* Charts grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Commissioni giornaliere">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tickFormatter={shortDay} stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip formatter={eurTip} labelFormatter={shortDay} />
              <Line type="monotone" dataKey="commission" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Commissione" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue generata">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tickFormatter={shortDay} stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip formatter={eurTip} labelFormatter={shortDay} />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Crescita utenti invitati">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tickFormatter={shortDay} stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip labelFormatter={shortDay} />
              <Bar dataKey="invitedUsers" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} name="Invitati" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sconti applicati">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tickFormatter={shortDay} stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip formatter={eurTip} labelFormatter={shortDay} />
              <Bar dataKey="discounts" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} name="Sconti" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Conversioni Premium / Gold">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Vendite" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue vs commissione">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tickFormatter={shortDay} stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip formatter={eurTip} labelFormatter={shortDay} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="commission" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Commissione" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Commission history */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Storico commissioni</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Utente</th>
                <th className="px-4 py-3 font-medium">Speso</th>
                <th className="px-4 py-3 font-medium">Commissione</th>
                <th className="px-4 py-3 font-medium">Fonte</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nessuna commissione registrata.
                  </td>
                </tr>
              ) : (
                commissions.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{c.userId.slice(-8)}</td>
                    <td className="px-4 py-3">{eur(c.amountSpent)}</td>
                    <td className="px-4 py-3 font-medium text-primary">{eur(c.commissionAmount)}</td>
                    <td className="px-4 py-3 capitalize">{c.source}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payout history */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Storico payout</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Importo</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">ID transazione</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nessuna richiesta di payout.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{eur(p.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.stripeTransferId || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Request payout modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Richiedi payout</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Saldo disponibile: <span className="font-medium text-foreground">{eur(balance?.available || 0)}</span> · minimo {eur(minPayout)}
            </p>
            <form onSubmit={submitPayout} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium" htmlFor="amount">
                  Importo (€)
                </label>
                <input
                  id="amount"
                  type="number"
                  min={minPayout}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder={String(minPayout)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium" htmlFor="destination">
                  Destinazione (PayPal / IBAN)
                </label>
                <input
                  id="destination"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="email@paypal.com o IBAN"
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Invio…" : "Richiedi payout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------------- subcomponents ---------------------------- */
function BalanceCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    approved: "bg-chart-2/15 text-chart-2",
    paid: "bg-primary/15 text-primary",
    rejected: "bg-destructive/15 text-destructive",
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.pending}`}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}
