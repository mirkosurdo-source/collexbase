"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Badge from "@/components/Badge"

type LockedCredit = { id: string; amount: number; source: string; releaseAt: string }
type WalletInfo = {
  money: number
  coins: number
  badge: string
  pendingLocked: number
  lockedCredits: LockedCredit[]
}
type Transaction = {
  id: string
  type: string
  currency: string
  amount: number
  description: string
  status: string
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposito",
  withdraw: "Prelievo",
  sale: "Vendita",
  purchase: "Acquisto",
  coins_purchase: "Acquisto monete",
  reward: "Ricompensa",
  release: "Sblocco accredito",
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function timeUntil(value: string): string {
  const ms = new Date(value).getTime() - Date.now()
  if (ms <= 0) return "a breve"
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

export default function WalletPage() {
  const router = useRouter()
  const [info, setInfo] = useState<WalletInfo | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const load = useCallback(async () => {
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const [infoRes, txRes] = await Promise.all([
        fetch("/api/wallet/info", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/wallet/transactions", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const infoData = await infoRes.json()
      const txData = await txRes.json()
      if (infoData.success) setInfo(infoData.wallet)
      if (txData.success) setTransactions(txData.transactions)
    } catch {
      setMessage("Impossibile caricare il wallet.")
    } finally {
      setLoading(false)
    }
  }, [router, token])

  useEffect(() => {
    load()
  }, [load])

  async function handleAction(action: "deposit" | "withdraw") {
    setMessage("")
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Inserisci un importo valido.")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/wallet/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: value }),
      })
      const data = await res.json()
      setMessage(data.message || "")
      if (data.success) {
        setAmount("")
        await load()
      }
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
        <p className="text-sm text-red-600 dark:text-red-400">{message || "Wallet non disponibile."}</p>
      </div>
    )
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Wallet</h1>
        <div className="flex items-center gap-2">
          <Badge tier={info.badge} />
          <Link
            href="/wallet/collex-coin"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Collex Coin
          </Link>
          <Link
            href="/wallet/coins"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Store monete
          </Link>
          <Link
            href="/wallet/rewards"
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Ricompense
          </Link>
        </div>
      </div>

      {/* Balances */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Saldo denaro</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">{formatEUR(info.money)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">CollexCoins</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {info.coins.toLocaleString("it-IT")}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">In attesa (48h)</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {formatEUR(info.pendingLocked)}
          </p>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {message}
        </p>
      )}

      {/* Deposit / Withdraw */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Deposita / Preleva</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Importo in €"
            className={inputClass}
          />
          <div className="flex gap-3">
            <button
              onClick={() => handleAction("deposit")}
              disabled={busy}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Deposita
            </button>
            <button
              onClick={() => handleAction("withdraw")}
              disabled={busy}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              Preleva
            </button>
          </div>
        </div>
      </div>

      {/* Locked credits */}
      {info.lockedCredits.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Accrediti bloccati</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {info.lockedCredits.map((credit) => (
              <li
                key={credit.id}
                className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900"
              >
                <span className="text-neutral-700 dark:text-neutral-300">{credit.source}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatEUR(credit.amount)}</span>
                  <span className="text-xs text-neutral-400">sblocco tra {timeUntil(credit.releaseAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transactions */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Storico transazioni</h2>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Nessuna transazione.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
            {transactions.map((tx) => {
              const positive = ["deposit", "sale", "reward", "coins_purchase", "release"].includes(tx.type)
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
                  <span
                    className={`text-sm font-semibold ${
                      positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {positive ? "+" : "-"}
                    {tx.currency === "coins" ? `${tx.amount} coins` : formatEUR(tx.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
