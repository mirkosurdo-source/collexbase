"use client"

import { useEffect, useState, useCallback } from "react"
import { QRCodeSVG } from "qrcode.react"

interface Dashboard {
  active: boolean
  referralCode: string
  link: string
  commissionRate: number
  commissionDurationMonths: number
  totalUsersInvited: number
  monthly: { month: string; commission: number; users: number }[]
  recentCommissions: { userId: string; amountSpent: number; commissionAmount: number; source: string; at: string }[]
}

interface Earnings {
  balance: number
  totalEarned: number
  pendingPayout: number
  totalPaidOut: number
  minPayout: number
}

interface PayoutRequest {
  id: string
  amount: number
  status: string
  destination: string
  at: string
}

/** Formats a number as euros (e.g. 12.5 → "€12,50"). */
function eur(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0)
}

export default function CreatorDashboard() {
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [data, setData] = useState<Dashboard | null>(null)
  const [earnings, setEarnings] = useState<Earnings | null>(null)
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [notCreator, setNotCreator] = useState(false)
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
    const auth = { Authorization: `Bearer ${token}` }
    try {
      const res = await fetch("/api/creator/dashboard", { headers: auth })
      const json = await res.json()
      if (res.status === 403) {
        setNotCreator(true)
        return
      }
      if (!res.ok || !json.ok) throw new Error(json.error || "Errore nel caricamento.")
      setData(json)

      const [eRes, pRes] = await Promise.all([
        fetch("/api/creator/earnings", { headers: auth }),
        fetch("/api/creator/payout", { headers: auth }),
      ])
      const eJson = await eRes.json().catch(() => null)
      if (eRes.ok && eJson?.ok) setEarnings(eJson)
      const pJson = await pRes.json().catch(() => null)
      if (pRes.ok && pJson?.ok) setPayouts(pJson.requests || [])
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
    if (!data?.link) return
    navigator.clipboard.writeText(data.link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [data?.link])

  if (checked && !token) {
    return <Gate title="Creator Partner" message="Accedi al tuo account per vedere la dashboard creator." />
  }

  if (notCreator) {
    return (
      <Gate
        title="Programma Creator Partner"
        message="Non fai ancora parte del programma Creator Partner. Diventa un creator per guadagnare commissioni reali sugli utenti che inviti."
      />
    )
  }

  const maxCommission = data ? Math.max(1, ...data.monthly.map((m) => m.commission)) : 1

  return (
    <div className="py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-balance text-neutral-900 dark:text-neutral-100">Creator Partner</h1>
        <p className="mt-1 text-pretty text-neutral-600 dark:text-neutral-400">
          Guadagni commissioni reali in euro sugli acquisti premium degli utenti che inviti.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      ) : data ? (
        <div className="space-y-6">
          {/* Pro analytics entry point */}
          <div className="flex justify-end">
            <a
              href="/creator/analytics"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Analytics avanzati e payout
            </a>
          </div>

          {/* Top stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Creator Earnings" value={eur(earnings?.balance ?? 0)} accent />
            <Stat label="Totale guadagnato" value={eur(earnings?.totalEarned ?? 0)} />
            <Stat label="In attesa payout" value={eur(earnings?.pendingPayout ?? 0)} />
            <Stat label="Pagato" value={eur(earnings?.totalPaidOut ?? 0)} />
            <Stat label="Utenti invitati" value={data.totalUsersInvited} />
            <Stat label="Commissione" value={`${Math.round(data.commissionRate * 100)}%`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Link */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    Link creator · <span className="font-mono">{data.referralCode}</span>
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      data.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {data.active ? "Attivo" : "Sospeso"}
                  </span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    readOnly
                    value={data.link}
                    className="flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                    aria-label="Link creator"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    {copied ? "Copiato!" : "Copia"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                  Gli invitati ottengono uno sconto sul premium e tu guadagni commissioni reali per{" "}
                  {data.commissionDurationMonths} mesi.
                </p>
              </div>

              {/* Commission chart */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Commissioni (6 mesi)
                </h2>
                <div className="flex h-40 items-end justify-between gap-2">
                  {data.monthly.map((m) => (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t bg-emerald-500/80 transition-all"
                          style={{ height: `${Math.max(4, (m.commission / maxCommission) * 100)}%` }}
                          title={eur(m.commission)}
                        />
                      </div>
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{m.month.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent commissions */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Commissioni recenti</h2>
                {data.recentCommissions.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessuna commissione ancora.</p>
                ) : (
                  <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {data.recentCommissions.map((c, i) => (
                      <li key={i} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium capitalize text-neutral-800 dark:text-neutral-200">
                            {c.source}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {new Date(c.at).toLocaleDateString("it-IT")} · spesa {eur(c.amountSpent)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          +{eur(c.commissionAmount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">QR Code</h2>
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG value={data.link} size={150} level="M" />
                </div>
              </div>
              <PayoutPanel
                token={token}
                balance={earnings?.balance ?? 0}
                minPayout={earnings?.minPayout ?? 10}
                requests={payouts}
                onDone={load}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PayoutPanel({
  token,
  balance,
  minPayout,
  requests,
  onDone,
}: {
  token: string | null
  balance: number
  minPayout: number
  requests: PayoutRequest[]
  onDone: () => void
}) {
  const [amount, setAmount] = useState("")
  const [destination, setDestination] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async () => {
    const n = Number(amount)
    if (!token || !Number.isFinite(n) || n <= 0) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/creator/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: n, destination }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Errore.")
      setMsg("Richiesta payout inviata!")
      setAmount("")
      setDestination("")
      onDone()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Errore.")
    } finally {
      setBusy(false)
    }
  }

  const statusLabel: Record<string, string> = {
    pending: "In attesa",
    approved: "Approvato",
    rejected: "Rifiutato",
  }
  const statusClass: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-1 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Richiedi payout</h2>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        Disponibile: {eur(balance)} · minimo {eur(minPayout)}
      </p>
      <div className="flex flex-col gap-2">
        <input
          type="number"
          min={minPayout}
          max={balance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Importo (€)"
          className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
        />
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="PayPal / IBAN (facoltativo)"
          className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || balance < minPayout}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Invio..." : "Richiedi payout"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{msg}</p>}

      {requests.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          {requests.slice(0, 5).map((r) => (
            <li key={r.id} className="flex items-center justify-between text-xs">
              <span className="text-neutral-600 dark:text-neutral-400">
                {eur(r.amount)} · {new Date(r.at).toLocaleDateString("it-IT")}
              </span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${statusClass[r.status] || ""}`}>
                {statusLabel[r.status] || r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Gate({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-pretty text-neutral-600 dark:text-neutral-400">{message}</p>
      <a
        href="/login"
        className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        Accedi
      </a>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-900">
      <p
        className={`text-lg font-bold ${
          accent ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  )
}
