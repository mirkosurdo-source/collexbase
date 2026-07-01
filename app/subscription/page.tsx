"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import SubscriptionBadge from "@/components/SubscriptionBadge"

type PlanId = "Base" | "Gold" | "Premium"
type BillingCycle = "monthly" | "yearly"

interface PlanPerks {
  id: PlanId
  name: string
  monthlyPrice: number
  yearlyPrice: number
  yearlySaving: number
  yearlySavingPct: number
  aiPerDay: number
  dailyCoins: number
  monthlyCoins: number
  signupBonus: number
  tradeFee: number
  tradeCoinsPct: number
  saleBuyerFee: number
  saleSellerFee: number
  hasBadge: boolean
  auctionEarlyAccess: "none" | "medium" | "total"
  priority: "standard" | "medium" | "high"
  highlights: string[]
}

interface SubInfo {
  plan: PlanId
  perks: PlanPerks
  billingCycle: BillingCycle
  subscription: {
    status: string
    price: number
    autoRenew: boolean
    startedAt: string
    currentPeriodEnd: string | null
  } | null
  ai: { unlimited: boolean; limit: number; used: number; remaining: number | null; resetAt: string }
  coins: {
    balance: number
    dailyAmount: number
    monthlyAmount: number
    dailyAvailable: boolean
    monthlyAvailable: boolean
    nextDailyAt: string | null
    nextMonthlyAt: string | null
  }
  signupBonus: { amount: number; claimed: boolean }
  money: number
}

const RANK: Record<PlanId, number> = { Base: 0, Gold: 1, Premium: 2 }

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value)
}

function timeUntil(value: string | null): string {
  if (!value) return "disponibile"
  const ms = new Date(value).getTime() - Date.now()
  if (ms <= 0) return "disponibile ora"
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `tra ${days}g ${hours}h`
  return hours > 0 ? `tra ${hours}h ${mins}m` : `tra ${mins}m`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<PlanPerks[]>([])
  const [info, setInfo] = useState<SubInfo | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>("monthly")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>("")
  const [message, setMessage] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const load = useCallback(async () => {
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const [perksRes, getRes] = await Promise.all([
        fetch("/api/subscription/perks"),
        fetch("/api/subscription/get", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const perksData = await perksRes.json()
      const getData = await getRes.json()
      if (perksData.success) setPlans(perksData.plans)
      if (getData.success) {
        setInfo(getData)
        setCycle(getData.billingCycle)
      }
    } catch {
      setMessage("Impossibile caricare gli abbonamenti.")
    } finally {
      setLoading(false)
    }
  }, [router, token])

  useEffect(() => {
    load()
  }, [load])

  async function changePlan(target: PlanId) {
    if (!info || !token) return
    const direction = RANK[target] > RANK[info.plan] ? "upgrade" : "downgrade"
    setBusy(target)
    setMessage("")
    try {
      const res = await fetch(`/api/subscription/${direction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: target, billingCycle: cycle }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setMessage(data.message || "Operazione non riuscita.")
      } else {
        let msg = data.message
        if (data.grantedSignupBonus) msg += ` +${data.grantedSignupBonus} Collex Coin di bonus iscrizione!`
        setMessage(msg)
        await load()
      }
    } catch {
      setMessage("Errore di rete.")
    } finally {
      setBusy("")
    }
  }

  async function renew() {
    if (!token) return
    setBusy("renew")
    setMessage("")
    try {
      const res = await fetch("/api/subscription/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ billingCycle: cycle }),
      })
      const data = await res.json()
      setMessage(data.message || (res.ok ? "Rinnovato." : "Operazione non riuscita."))
      if (res.ok && data.success) await load()
    } catch {
      setMessage("Errore di rete.")
    } finally {
      setBusy("")
    }
  }

  async function claimCoins(kind: "daily" | "monthly") {
    if (!token) return
    setBusy(`coins-${kind}`)
    setMessage("")
    try {
      const res = await fetch(`/api/subscription/coins/${kind}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMessage(data.message || "Operazione non riuscita.")
      if (res.ok && data.success) await load()
    } catch {
      setMessage("Errore di rete.")
    } finally {
      setBusy("")
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-96 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">Abbonamento</h1>
        <p className="text-pretty text-neutral-600 dark:text-neutral-400">
          Scegli il piano CollexBase più adatto a te. Aggiorna o riduci in qualsiasi momento.
        </p>
      </header>

      {message && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </div>
      )}

      {info && (
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Piano attuale: {info.plan}
              </span>
              <SubscriptionBadge plan={info.plan} />
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {info.plan === "Base"
                ? "Piano gratuito"
                : info.subscription?.currentPeriodEnd
                  ? `Rinnovo il ${formatDate(info.subscription.currentPeriodEnd)} · ${info.billingCycle === "yearly" ? "annuale" : "mensile"}`
                  : "Attivo"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* AI credits */}
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Valutazioni AI</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                {info.ai.unlimited ? "Illimitate" : `${info.ai.remaining ?? 0}/${info.ai.limit}`}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {info.ai.unlimited ? "Premium" : `Reset ${timeUntil(info.ai.resetAt)}`}
              </p>
            </div>

            {/* Coins balance */}
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Collex Coins</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">{info.coins.balance}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Saldo disponibile</p>
            </div>

            {/* Daily coins */}
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Bonus giornaliero</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">+{info.coins.dailyAmount}</p>
              <button
                onClick={() => claimCoins("daily")}
                disabled={!info.coins.dailyAvailable || busy === "coins-daily"}
                className="mt-2 w-full rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors enabled:hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:enabled:hover:bg-neutral-300"
              >
                {info.coins.dailyAvailable ? "Riscuoti" : timeUntil(info.coins.nextDailyAt)}
              </button>
            </div>

            {/* Monthly coins */}
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Bonus mensile</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                +{info.coins.monthlyAmount}
              </p>
              <button
                onClick={() => claimCoins("monthly")}
                disabled={!info.coins.monthlyAvailable || busy === "coins-monthly"}
                className="mt-2 w-full rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors enabled:hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:enabled:hover:bg-neutral-300"
              >
                {info.coins.monthlyAvailable ? "Riscuoti" : timeUntil(info.coins.nextMonthlyAt)}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">
              Bonus iscrizione: {info.signupBonus.claimed ? "già riscosso" : `${info.signupBonus.amount} Collex Coin`}
            </span>
            {info.plan !== "Base" && (
              <button
                onClick={renew}
                disabled={busy === "renew"}
                className="rounded-lg border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                {busy === "renew" ? "..." : "Rinnova ora"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Billing cycle toggle */}
      <div className="mt-10 flex items-center justify-center gap-3">
        <span className={`text-sm ${cycle === "monthly" ? "font-semibold text-neutral-900 dark:text-neutral-50" : "text-neutral-500"}`}>
          Mensile
        </span>
        <button
          role="switch"
          aria-checked={cycle === "yearly"}
          aria-label="Cambia ciclo di fatturazione"
          onClick={() => setCycle((c) => (c === "monthly" ? "yearly" : "monthly"))}
          className={`relative h-6 w-11 rounded-full transition-colors ${cycle === "yearly" ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${cycle === "yearly" ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
        <span className={`text-sm ${cycle === "yearly" ? "font-semibold text-neutral-900 dark:text-neutral-50" : "text-neutral-500"}`}>
          Annuale
        </span>
      </div>

      {/* Pricing cards */}
      <section className="mt-6 grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = info?.plan === p.id
          const price = cycle === "yearly" ? p.yearlyPrice : p.monthlyPrice
          const featured = p.id === "Gold"
          const direction = info ? (RANK[p.id] > RANK[info.plan] ? "Upgrade" : RANK[p.id] < RANK[info.plan] ? "Downgrade" : "") : ""
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 dark:bg-neutral-950 ${
                featured
                  ? "border-amber-400 shadow-lg dark:border-amber-700"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-semibold text-amber-950">
                  Più popolare
                </span>
              )}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{p.name}</h2>
                <SubscriptionBadge plan={p.id} size="sm" />
              </div>

              <div className="mt-4 flex items-end gap-1">
                <span className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                  {price === 0 ? "Gratis" : formatEUR(price)}
                </span>
                {price > 0 && (
                  <span className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">
                    /{cycle === "yearly" ? "anno" : "mese"}
                  </span>
                )}
              </div>
              {cycle === "yearly" && p.yearlySaving > 0 && (
                <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Risparmi {formatEUR(p.yearlySaving)} ({p.yearlySavingPct}%)
                </p>
              )}

              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="mt-0.5 text-emerald-500" aria-hidden="true">
                      ✓
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => changePlan(p.id)}
                disabled={isCurrent || busy === p.id}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  featured
                    ? "bg-amber-400 text-amber-950 enabled:hover:bg-amber-300"
                    : "bg-neutral-900 text-white enabled:hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:enabled:hover:bg-neutral-300"
                }`}
              >
                {busy === p.id ? "..." : isCurrent ? "Piano attuale" : direction || "Seleziona"}
              </button>
            </div>
          )
        })}
      </section>

      {/* Comparison table */}
      {plans.length === 3 && (
        <section className="mt-12 overflow-x-auto">
          <h2 className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-50">Confronto vantaggi</h2>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                <th className="py-3 pr-4 font-medium text-neutral-500 dark:text-neutral-400">Vantaggio</th>
                {plans.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-center font-semibold text-neutral-900 dark:text-neutral-50">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-neutral-700 dark:text-neutral-300">
              {[
                { label: "Valutazioni AI / giorno", get: (p: PlanPerks) => (p.aiPerDay === -1 ? "Illimitate" : `${p.aiPerDay}`) },
                { label: "Collex Coins / giorno", get: (p: PlanPerks) => `${p.dailyCoins}` },
                { label: "Bonus mensile", get: (p: PlanPerks) => `${p.monthlyCoins}` },
                { label: "Bonus iscrizione", get: (p: PlanPerks) => `${p.signupBonus}` },
                { label: "Commissioni scambi", get: (p: PlanPerks) => `${(p.tradeFee * 100).toFixed(0)}%` },
                { label: "Monete scambi", get: (p: PlanPerks) => `${(p.tradeCoinsPct * 100).toFixed(0)}%` },
                { label: "Commissioni vendita (buyer)", get: (p: PlanPerks) => `${(p.saleBuyerFee * 100).toLocaleString("it-IT")}%` },
                { label: "Commissioni vendita (seller)", get: (p: PlanPerks) => `${(p.saleSellerFee * 100).toLocaleString("it-IT")}%` },
                {
                  label: "Accesso anticipato aste",
                  get: (p: PlanPerks) =>
                    p.auctionEarlyAccess === "total" ? "Totale" : p.auctionEarlyAccess === "medium" ? "Sì" : "—",
                },
                { label: "Badge profilo", get: (p: PlanPerks) => (p.hasBadge ? p.name : "—") },
              ].map((row) => (
                <tr key={row.label} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-3 pr-4">{row.label}</td>
                  {plans.map((p) => (
                    <td key={p.id} className="px-4 py-3 text-center font-medium">
                      {row.get(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-600">
        I pagamenti sono in modalità demo: upgrade, downgrade e rinnovo non addebitano importi reali.
      </p>
    </main>
  )
}
