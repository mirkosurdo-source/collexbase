"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatEUR, timeAgo } from "@/lib/format"

interface WalletState {
  available: number
  pending: number
  blocked: number
  currency: string
}

interface Tx {
  _id: string
  kind: string
  amount: number
  status: string
  description: string
  createdAt: string
}

interface EscrowItem {
  _id: string
  itemName: string
  amount: number
  buyerTotal: number
  sellerNet: number
  status: string
  role: "buyer" | "seller"
  createdAt: string
}

const KIND_LABELS: Record<string, string> = {
  deposit: "Ricarica",
  withdrawal: "Prelievo",
  transfer_in: "Trasferimento ricevuto",
  transfer_out: "Trasferimento inviato",
  escrow_hold: "Pagamento in attesa",
  escrow_release: "Fondi rilasciati",
  escrow_refund: "Rimborso",
  seller_fee: "Commissione venditore",
  buyer_fee: "Commissione acquirente",
  subscription: "Abbonamento",
  trade_fee: "Commissione scambio",
  dispute_hold: "Disputa",
}

const ESCROW_LABELS: Record<string, string> = {
  awaiting_payment: "In attesa di pagamento",
  held: "In escrow",
  released: "Rilasciato",
  disputed: "In disputa",
  refunded: "Rimborsato",
}

export default function PaymentsPage() {
  const router = useRouter()
  const [wallet, setWallet] = useState<WalletState | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [escrows, setEscrows] = useState<EscrowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [iban, setIban] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const load = useCallback(async () => {
    if (!token) {
      router.push("/login")
      return
    }
    try {
      const [w, e] = await Promise.all([
        fetch("/api/payments/wallet", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/payments/escrows", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (w.ok) {
        const wd = await w.json()
        setWallet(wd.wallet)
        setTxs(wd.transactions || [])
      }
      if (e.ok) {
        const ed = await e.json()
        setEscrows(ed.escrows || [])
      }
    } finally {
      setLoading(false)
    }
  }, [token, router])

  useEffect(() => {
    load()
  }, [load])

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true)
    setMessage("")
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "Operazione non riuscita.")
        return false
      }
      setMessage(data.message || "Fatto.")
      await load()
      return true
    } catch {
      setMessage("Errore di rete.")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleDeposit() {
    const amount = Number(depositAmount)
    if (!amount || amount <= 0) return
    const ok = await post("/api/payments/wallet/deposit", { amount })
    if (ok) setDepositAmount("")
  }

  async function handleWithdraw() {
    const amount = Number(withdrawAmount)
    if (!amount || amount <= 0) return
    const ok = await post("/api/payments/wallet/withdraw", { amount, iban })
    if (ok) {
      setWithdrawAmount("")
      setIban("")
    }
  }

  async function escrowAction(escrowId: string, action: "deliver" | "dispute") {
    if (action === "deliver") {
      await post("/api/payments/marketplace/deliver", { escrowId })
    } else {
      const reason = prompt("Motivo della disputa:") || ""
      await post("/api/payments/marketplace/dispute", { escrowId, reason })
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Pagamenti</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Gestisci il tuo saldo, i prelievi e le transazioni protette da escrow.
        </p>
      </header>

      {message && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Disponibile
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {formatEUR(wallet?.available || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            In attesa
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-500">
            {formatEUR(wallet?.pending || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Bloccato
          </p>
          <p className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-500">
            {formatEUR(wallet?.blocked || 0)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">Ricarica saldo</h2>
          <div className="flex flex-col gap-3">
            <input
              type="number"
              min="1"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Importo in €"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:text-neutral-50"
            />
            <button
              onClick={handleDeposit}
              disabled={busy}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Ricarica
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">Preleva fondi</h2>
          <div className="flex flex-col gap-3">
            <input
              type="number"
              min="1"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Importo in €"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:text-neutral-50"
            />
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="IBAN"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:text-neutral-50"
            />
            <button
              onClick={handleWithdraw}
              disabled={busy}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              Richiedi prelievo
            </button>
          </div>
        </div>
      </section>

      {escrows.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Transazioni escrow</h2>
          <div className="flex flex-col gap-3">
            {escrows.map((e) => (
              <div
                key={e._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900 dark:text-neutral-50">{e.itemName}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {e.role === "buyer" ? "Acquisto" : "Vendita"} · {ESCROW_LABELS[e.status] || e.status} ·{" "}
                    {timeAgo(e.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatEUR(e.role === "buyer" ? e.buyerTotal : e.sellerNet)}
                  </span>
                  {e.role === "buyer" && e.status === "held" && (
                    <>
                      <button
                        onClick={() => escrowAction(e._id, "deliver")}
                        disabled={busy}
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-50 hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900"
                      >
                        Conferma consegna
                      </button>
                      <button
                        onClick={() => escrowAction(e._id, "dispute")}
                        disabled={busy}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                      >
                        Apri disputa
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Movimenti</h2>
        {txs.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessun movimento ancora.</p>
        ) : (
          <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
            {txs.map((t) => (
              <div key={t._id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
                    {t.description || KIND_LABELS[t.kind] || t.kind}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {KIND_LABELS[t.kind] || t.kind} · {timeAgo(t.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    t.amount >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-neutral-900 dark:text-neutral-50"
                  }`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {formatEUR(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
