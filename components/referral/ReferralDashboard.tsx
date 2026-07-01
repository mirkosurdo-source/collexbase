"use client"

import { useEffect, useState, useCallback } from "react"
import { QRCodeSVG } from "qrcode.react"

interface ReferralStats {
  code: string
  link: string
  totalInvites: number
  confirmedInvites: number
  coinsEarned: number
  invites: { username: string; status: string; method: string; createdAt: string }[]
}

export default function ReferralDashboard() {
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    setToken(t)
    setChecked(true)
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/referral/stats", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Errore nel caricamento.")
      setStats(data.stats)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel caricamento.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  const copyLink = useCallback(() => {
    if (!stats?.link) return
    navigator.clipboard.writeText(stats.link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [stats?.link])

  if (checked && !token) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Invita amici</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Accedi al tuo account per ottenere il tuo link di invito.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Accedi
        </a>
      </div>
    )
  }

  const shareText = stats
    ? `Unisciti a me su CollexBase! Usa il mio link e iniziamo a collezionare insieme: ${stats.link}`
    : ""

  return (
    <div className="py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-balance text-neutral-900 dark:text-neutral-100">Invita amici, guadagna CollexCoins</h1>
        <p className="mt-1 text-pretty text-neutral-600 dark:text-neutral-400">
          Per ogni amico che si iscrive con il tuo link ricevete entrambi <strong>20 CollexCoins</strong>.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      ) : stats ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Link + QR + share */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Il tuo link di invito</h2>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  readOnly
                  value={stats.link}
                  className="flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                  aria-label="Link di invito"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  {copied ? "Copiato!" : "Copia"}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  WhatsApp
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(stats.link)}&text=${encodeURIComponent("Unisciti a me su CollexBase!")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#229ED9] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Telegram
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent("Unisciti a CollexBase")}&body=${encodeURIComponent(shareText)}`}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Email
                </a>
              </div>
            </div>

            {/* Invite history */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Inviti recenti</h2>
              {stats.invites.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Nessun invito ancora. Condividi il tuo link per iniziare!
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {stats.invites.map((inv, i) => (
                    <li key={i} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{inv.username}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {new Date(inv.createdAt).toLocaleDateString("it-IT")} · {inv.method}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          inv.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                        }`}
                      >
                        {inv.status === "confirmed" ? "Confermato" : "In attesa"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Sidebar: QR + stats */}
          <div className="space-y-6">
            <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">QR Code</h2>
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={stats.link} size={160} level="M" />
              </div>
              <p className="mt-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Inquadra per aprire il link di invito
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Inviti" value={stats.totalInvites} />
              <Stat label="Confermati" value={stats.confirmedInvites} />
              <Stat label="Coins" value={stats.coinsEarned} accent />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-900">
      <p className={`text-xl font-bold ${accent ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-100"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  )
}
