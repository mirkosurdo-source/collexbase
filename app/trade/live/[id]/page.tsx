"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import LiveTimer from "@/components/live/LiveTimer"
import LiveChat from "@/components/live/LiveChat"

interface TradeItem {
  id: string
  itemId: string
  name: string
  image: string
  addedBy: string
}

interface TradeState {
  id: string
  userA: string
  userAUsername: string
  userB: string
  userBUsername: string
  itemsA: TradeItem[]
  itemsB: TradeItem[]
  coinsA: number
  coinsB: number
  status: string
  confirmedA: boolean
  confirmedB: boolean
  timerSeconds: number
  expiresAt: string | null
  completedAt: string | null
  viewerIsA: boolean
  viewerIsParticipant: boolean
  chat: {
    id: string
    userId: string
    username: string
    message: string
    system: boolean
    createdAt: string | null
  }[]
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function LiveTradeDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id
  const [trade, setTrade] = useState<TradeState | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [itemName, setItemName] = useState("")
  const [coins, setCoins] = useState("")
  const [chatError, setChatError] = useState("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/live-trade/status/${id}`, { headers: authHeaders() })
      const data = await res.json()
      if (res.ok && data.success) {
        setTrade(data.trade)
      } else if (res.status === 401) {
        setError("Devi accedere per vedere questo scambio.")
      } else if (res.status === 404) {
        setError("Scambio non trovato.")
      }
    } catch {
      // transient network error; keep polling
    }
  }, [id])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  async function call(path: string, body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id, ...body }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.message || "Operazione non riuscita.")
      } else if (data.trade) {
        setTrade(data.trade)
      }
    } catch {
      setError("Errore di rete. Riprova.")
    } finally {
      setBusy(false)
    }
  }

  async function sendChat(text: string) {
    setChatError("")
    try {
      const res = await fetch("/api/live-trade/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ tradeId: id, message: text }),
      })
      const data = await res.json()
      if (res.ok && data.success) setTrade(data.trade)
      else setChatError(data.message || "Messaggio non inviato.")
    } catch {
      setChatError("Errore di rete. Riprova.")
    }
  }

  if (error && !trade) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg text-muted-foreground">{error}</p>
        <Link href="/trade/live" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          Avvia un nuovo scambio
        </Link>
      </main>
    )
  }

  if (!trade) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Caricamento scambio...</p>
      </main>
    )
  }

  const isParticipant = trade.viewerIsParticipant
  const viewerIsA = trade.viewerIsA
  const isLive = trade.status === "live"
  const myConfirmed = viewerIsA ? trade.confirmedA : trade.confirmedB
  const theirConfirmed = viewerIsA ? trade.confirmedB : trade.confirmedA
  const myItems = viewerIsA ? trade.itemsA : trade.itemsB
  const myCoins = viewerIsA ? trade.coinsA : trade.coinsB

  function addItem() {
    const name = itemName.trim()
    if (!name) return
    call("/api/live-trade/add-item", { name })
    setItemName("")
  }

  function setMyCoins() {
    const value = Math.max(0, Math.floor(Number(coins) || 0))
    call("/api/live-trade/add-item", { coins: value })
    setCoins("")
  }

  const statusBadge =
    trade.status === "completed"
      ? { label: "Completato", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" }
      : trade.status === "cancelled"
        ? { label: "Annullato", cls: "bg-destructive/10 text-destructive" }
        : trade.status === "expired"
          ? { label: "Scaduto", cls: "bg-muted text-muted-foreground" }
          : { label: "In corso", cls: "bg-primary/10 text-primary" }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Scambio Live</h1>
          <p className="text-sm text-muted-foreground">
            {trade.userAUsername} {"\u2194"} {trade.userBUsername}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
          {isLive ? <LiveTimer endAt={trade.expiresAt} onExpire={load} /> : null}
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Two trade panels */}
        <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
          <TradePanel
            title={`${trade.userAUsername}${viewerIsA ? " (tu)" : ""}`}
            items={trade.itemsA}
            coins={trade.coinsA}
            confirmed={trade.confirmedA}
          />
          <TradePanel
            title={`${trade.userBUsername}${!viewerIsA && isParticipant ? " (tu)" : ""}`}
            items={trade.itemsB}
            coins={trade.coinsB}
            confirmed={trade.confirmedB}
          />
        </div>

        {/* Chat */}
        <div className="lg:col-span-1">
          <LiveChat
            messages={trade.chat}
            currentUserId={viewerIsA ? trade.userA : trade.userB}
            onSend={sendChat}
            disabled={!isParticipant || !isLive}
            error={chatError}
          />
        </div>
      </div>

      {/* Participant controls */}
      {isParticipant && isLive ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium text-card-foreground">La tua offerta</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-card-foreground">Aggiungi oggetto</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Nome oggetto"
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={addItem}
                  disabled={busy}
                  className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  Aggiungi
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-card-foreground">Offri CollexCoin</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={coins}
                  onChange={(e) => setCoins(e.target.value)}
                  placeholder={`Attuale: ${myCoins}`}
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={setMyCoins}
                  disabled={busy}
                  className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  Imposta
                </button>
              </div>
            </div>
          </div>

          {/* My items quick-remove */}
          {myItems.length > 0 ? (
            <div className="mt-4">
              <span className="text-sm font-medium text-card-foreground">I tuoi oggetti</span>
              <ul className="mt-2 flex flex-wrap gap-2">
                {myItems.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground"
                  >
                    {it.name}
                    <button
                      type="button"
                      onClick={() => call("/api/live-trade/remove-item", { itemKey: it.id })}
                      disabled={busy}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Rimuovi ${it.name}`}
                    >
                      {"\u00d7"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Confirm / cancel */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => call("/api/live-trade/confirm", { confirm: !myConfirmed })}
              disabled={busy}
              className={`rounded-lg px-5 py-2 font-medium transition-opacity hover:opacity-90 disabled:opacity-60 ${
                myConfirmed
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {myConfirmed ? "Annulla conferma" : "Conferma scambio"}
            </button>
            <button
              type="button"
              onClick={() => call("/api/live-trade/cancel", {})}
              disabled={busy}
              className="rounded-lg border border-border px-5 py-2 font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              Annulla scambio
            </button>
            <span className="text-sm text-muted-foreground">
              {theirConfirmed
                ? "L'altro utente ha confermato. In attesa di te."
                : "In attesa che entrambi confermino."}
            </span>
          </div>
        </div>
      ) : null}

      {/* Completed summary */}
      {trade.status === "completed" ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <h2 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            Scambio completato
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entrambi i partecipanti hanno confermato. Gli oggetti sono stati scambiati.
          </p>
        </div>
      ) : null}

      {!isParticipant ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Stai osservando questo scambio. Solo i partecipanti possono agire.
        </p>
      ) : null}
    </main>
  )
}

function TradePanel({
  title,
  items,
  coins,
  confirmed,
}: {
  title: string
  items: TradeItem[]
  coins: number
  confirmed: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-card-foreground">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            confirmed ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
          }`}
        >
          {confirmed ? "Confermato" : "In attesa"}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Nessun oggetto
          </li>
        ) : (
          items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
            >
              <span className="truncate">{it.name}</span>
            </li>
          ))
        )}
      </ul>

      {coins > 0 ? (
        <p className="mt-3 text-sm font-medium text-card-foreground">
          + {coins} CollexCoin
        </p>
      ) : null}
    </div>
  )
}
