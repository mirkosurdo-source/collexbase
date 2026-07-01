"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

/**
 * Compact Collex Coin balance chip with a link to the Collex Coin wallet.
 * Drop-in indicator for the user profile (Blocco 15.1, section 5).
 */
export default function CollexCoinIndicator() {
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) return
    let active = true
    fetch("/api/coins/balance", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.success) setBalance(d.balance)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <Link
      href="/wallet/collex-coin"
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
        CC
      </span>
      <span className="font-medium text-neutral-900 dark:text-neutral-100">
        {balance === null ? "—" : balance.toLocaleString("it-IT")}
      </span>
      <span className="text-xs text-neutral-400">Collex Coin</span>
    </Link>
  )
}
