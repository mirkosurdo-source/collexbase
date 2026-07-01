"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Badge from "@/components/Badge"
import ValueLineChart from "@/components/charts/ValueLineChart"
import CategoryBarChart from "@/components/charts/CategoryBarChart"
import ModerationFlags from "@/components/moderation/ModerationFlags"

type SessionUser = {
  id: string
  name: string
  username: string
  email: string
  avatar?: string
}

type WalletInfo = { money: number; coins: number; badge: string; pendingLocked: number }

type Point = { label: string; value: number }
type CategoryDatum = { category: string; value: number; count: number }
type ValueStats = {
  totalItems: number
  totalValue: number
  valueByCategory: CategoryDatum[]
  trend: { day: Point[]; week: Point[]; month: Point[]; year: Point[] }
}

type Range = "day" | "week" | "month" | "year"
const RANGE_LABELS: Record<Range, string> = { day: "Giorno", week: "Settimana", month: "Mese", year: "Anno" }

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [stats, setStats] = useState<ValueStats | null>(null)
  const [range, setRange] = useState<Range>("month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }

    async function loadAll() {
      try {
        const sessionRes = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        const sessionData = await sessionRes.json()
        if (!sessionData.success) {
          localStorage.removeItem("token")
          document.cookie = "token=; path=/; max-age=0"
          router.replace("/login")
          return
        }
        setUser(sessionData.user)

        const [walletRes, statsRes] = await Promise.all([
          fetch("/api/wallet/info", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/collections/value-stats", { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const walletData = await walletRes.json()
        const statsData = await statsRes.json()
        if (walletData.success) setWallet(walletData.wallet)
        if (statsData.success) setStats(statsData)
      } catch {
        setError("Impossibile caricare la dashboard.")
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [router])

  function handleLogout() {
    localStorage.removeItem("token")
    document.cookie = "token=; path=/; max-age=0"
    router.replace("/login")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Sessione non valida."}</p>
      </div>
    )
  }

  return (
    <div className="py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar || "/placeholder.svg"}
              alt={`Avatar di ${user.name}`}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-lg font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Ciao, {user.name}
            </h1>
            <Link
              href={`/u/${user.username}`}
              className="text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
            >
              @{user.username}
            </Link>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Logout
        </button>
      </div>

      {/* Moderation flags (Blocco 37) */}
      <ModerationFlags className="mt-6" />

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Saldo denaro</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {wallet ? formatEUR(wallet.money) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">CollexCoins</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {wallet ? wallet.coins.toLocaleString("it-IT") : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Valore collezione</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {stats ? formatEUR(stats.totalValue) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Badge</p>
            {wallet && <Badge tier={wallet.badge} />}
          </div>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {stats ? stats.totalItems : 0} <span className="text-sm font-normal text-neutral-400">oggetti</span>
          </p>
        </div>
      </div>

      {/* Trend chart */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Andamento valore</h2>
          <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
            {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  range === r
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {stats && stats.totalValue > 0 ? (
            <ValueLineChart data={stats.trend[range]} />
          ) : (
            <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
              Aggiungi oggetti alla tua collezione per vedere l&apos;andamento del valore.
            </p>
          )}
        </div>
      </div>

      {/* Value by category */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Valore per categoria</h2>
        {stats && stats.valueByCategory.length > 0 ? (
          <CategoryBarChart data={stats.valueByCategory} height={Math.max(180, stats.valueByCategory.length * 36)} />
        ) : (
          <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Nessuna categoria da mostrare.
          </p>
        )}
      </div>
    </div>
  )
}
