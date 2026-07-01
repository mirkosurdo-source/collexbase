"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Badge from "@/components/Badge"

type Tier = "Base" | "Gold" | "Premium"

const DAILY: Record<Tier, number> = { Base: 1, Gold: 5, Premium: 10 }
const WEEKLY: Record<Tier, number> = { Base: 10, Gold: 35, Premium: 70 }
const MONTHLY: Record<Tier, number> = { Base: 50, Gold: 150, Premium: 300 }
const SIGNUP: Record<Tier, number> = { Base: 100, Gold: 200, Premium: 300 }

type RewardKey = "daily" | "weekly" | "monthly" | "signup"

export default function RewardsPage() {
  const router = useRouter()
  const [badge, setBadge] = useState<Tier>("Base")
  const [coins, setCoins] = useState<number | null>(null)
  const [busy, setBusy] = useState<RewardKey | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  useEffect(() => {
    if (!token) {
      router.replace("/login")
      return
    }
    async function load() {
      const res = await fetch("/api/wallet/info", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setBadge((["Base", "Gold", "Premium"].includes(data.wallet.badge) ? data.wallet.badge : "Base") as Tier)
        setCoins(data.wallet.coins)
      }
    }
    load()
  }, [router, token])

  async function claim(key: RewardKey) {
    setBusy(key)
    try {
      const res = await fetch(`/api/wallet/rewards/${key}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMessages((m) => ({ ...m, [key]: data.message || "" }))
      if (data.success && typeof data.coins === "number") setCoins(data.coins)
    } catch {
      setMessages((m) => ({ ...m, [key]: "Errore di rete." }))
    } finally {
      setBusy(null)
    }
  }

  const rewards: { key: RewardKey; title: string; desc: string; amount: number }[] = [
    { key: "daily", title: "Ricompensa giornaliera", desc: "Riscuoti ogni 24 ore", amount: DAILY[badge] },
    { key: "weekly", title: "Bonus settimanale", desc: "Riscuoti ogni 7 giorni", amount: WEEKLY[badge] },
    { key: "monthly", title: "Bonus mensile", desc: "Riscuoti ogni 30 giorni", amount: MONTHLY[badge] },
    { key: "signup", title: "Bonus iscrizione", desc: "Una tantum, alla registrazione", amount: SIGNUP[badge] },
  ]

  return (
    <div className="py-10">
      <Link href="/wallet" className="text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400">
        ← Wallet
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Ricompense</h1>
        <div className="flex items-center gap-3">
          <Badge tier={badge} />
          {coins !== null && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{coins.toLocaleString("it-IT")}</span> coins
            </p>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Gli importi delle ricompense dipendono dal tuo badge ({badge}).
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rewards.map((reward) => (
          <div
            key={reward.key}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{reward.title}</p>
              <p className="text-xs text-neutral-400">{reward.desc}</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">+{reward.amount} coins</p>
              {messages[reward.key] && (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{messages[reward.key]}</p>
              )}
            </div>
            <button
              onClick={() => claim(reward.key)}
              disabled={busy === reward.key}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {busy === reward.key ? "..." : "Riscuoti"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
