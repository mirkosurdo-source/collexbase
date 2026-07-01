"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Badge from "@/components/Badge"

type Summary = {
  signupBonus: number
  signupBonusClaimed: boolean
  dailyCoins: number
  monthlyCoins: number
  premiumDiscountActive: boolean
  premiumDiscountPct: number
  tradeCoinsPct: number
}
type BalanceInfo = {
  balance: number
  plan: string
  lastDailyAt: string | null
  summary: Summary
}
type CoinTx = {
  id: string
  amount: number
  type: string
  description: string
  balanceAfter: number
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  bonus_signup: "Bonus iscrizione",
  daily_reward: "Ricompensa giornaliera",
  trade_fee: "Fee scambio",
  sale_fee: "Fee vendita",
  purchase_coins: "Acquisto monete",
  discount: "Sconto",
  manual_adjustment: "Rettifica",
  spend: "Utilizzo",
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function CollexCoinPage() {
  const router = useRouter()
  const [info, setInfo] = useState<BalanceInfo | null>(null)
  const [transactions, setTransactions] = useState<CoinTx[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const load = useCallback(async () => {
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/coins/balance", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/coins/transactions?limit=30", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const balData = await balRes.json()
      const txData = await txRes.json()
      if (balData.success) setInfo(balData)
      if (txData.success) setTransactions(txData.transactions)
    } catch {
      setMessage("Impossibile caricare le Collex Coin.")
    } finally {
      setLoading(false)
    }
  }, [router, token])

  useEffect(() => {
    load()
  }, [load])

  async function claimDaily() {
    setMessage("")
    setBusy(true)
    try {
      const res = await fetch("/api/coins/apply-daily", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMessage(data.message || "")
      if (data.success) await load()
    } catch {
      setMessage("Errore di rete.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">{message || "Collex Coin non disponibili."}</p>
      </div>
    )
  }

  const { summary } = info
  const claimedToday = (() => {
    if (!info.lastDailyAt) return false
    const d = new Date(info.lastDailyAt)
    const now = new Date()
    return (
      d.getUTCFullYear() === now.getUTCFullYear() &&
      d.getUTCMonth() === now.getUTCMonth() &&
      d.getUTCDate() === now.getUTCDate()
    )
  })()

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/wallet" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-200">
            ← Wallet
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Collex Coin</h1>
        </div>
        <Badge tier={info.plan} />
      </div>

      {/* Balance hero */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Saldo Collex Coin</p>
            <p className="mt-1 text-4xl font-semibold text-neutral-900 dark:text-neutral-50">
              {info.balance.toLocaleString("it-IT")}
              <span className="ml-2 text-base font-normal text-neutral-400">CC</span>
            </p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Piano attuale: {info.plan}</p>
          </div>
          <button
            onClick={claimDaily}
            disabled={busy || claimedToday}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {claimedToday ? "Già riscattate oggi" : `Riscatta +${summary.dailyCoins} oggi`}
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {message}
        </p>
      )}

      {/* Tier summary */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Bonus iscrizione</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{summary.signupBonus} CC</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {summary.signupBonusClaimed ? "Ricevuto" : "Da accreditare"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Coin giornaliere</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{summary.dailyCoins} CC</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Per accesso alla piattaforma</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Bonus mensile</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{summary.monthlyCoins} CC</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Legato all'abbonamento</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Sconto monete</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {summary.premiumDiscountActive ? `-${Math.round(summary.premiumDiscountPct * 100)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {summary.premiumDiscountActive ? "Attivo (Premium)" : "Solo Premium"}
          </p>
        </div>
      </div>

      {!summary.premiumDiscountActive && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Passa a Premium per sbloccare gli sconti sulle Collex Coin e le funzioni esclusive.
          </p>
          <Link
            href="/subscription"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Vedi abbonamenti
          </Link>
        </div>
      )}

      {/* Transactions */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Movimenti Collex Coin</h2>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Nessun movimento.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
            {transactions.map((tx) => {
              const positive = tx.amount >= 0
              return (
                <li key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {TYPE_LABELS[tx.type] || tx.type}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {tx.description} · {formatDateTime(tx.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-semibold ${
                        positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {tx.amount} CC
                    </span>
                    <p className="text-xs text-neutral-400">saldo {tx.balanceAfter}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
