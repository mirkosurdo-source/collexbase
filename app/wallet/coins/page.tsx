"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const PACKAGES = [
  { coins: 50, price: 0.99 },
  { coins: 250, price: 3.99 },
  { coins: 1000, price: 12.99 },
  { coins: 5000, price: 49.99 },
  { coins: 10000, price: 89.99 },
]

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value)
}

export default function CoinsStorePage() {
  const router = useRouter()
  const [coins, setCoins] = useState<number | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [message, setMessage] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  useEffect(() => {
    if (!token) {
      router.replace("/login")
      return
    }
    async function load() {
      const res = await fetch("/api/wallet/info", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setCoins(data.wallet.coins)
    }
    load()
  }, [router, token])

  async function buy(pkgCoins: number) {
    setMessage("")
    setBusy(pkgCoins)
    try {
      const res = await fetch("/api/wallet/coins/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ coins: pkgCoins }),
      })
      const data = await res.json()
      setMessage(data.message || "")
      if (data.success) setCoins(data.coins)
    } catch {
      setMessage("Errore di rete.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="py-10">
      <Link href="/wallet" className="text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400">
        ← Wallet
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Store CollexCoins</h1>
        {coins !== null && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Saldo attuale: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{coins.toLocaleString("it-IT")}</span> coins
          </p>
        )}
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {message}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PACKAGES.map((pkg) => (
          <div
            key={pkg.coins}
            className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-950"
          >
            <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
              {pkg.coins.toLocaleString("it-IT")}
            </p>
            <p className="text-xs uppercase tracking-wide text-neutral-400">CollexCoins</p>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{formatEUR(pkg.price)}</p>
            <button
              onClick={() => buy(pkg.coins)}
              disabled={busy === pkg.coins}
              className="mt-1 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {busy === pkg.coins ? "Acquisto..." : "Acquista"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
