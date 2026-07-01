"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

const COINS_TO_EUR = 0.01

interface CollectionItem {
  _id: string
  name: string
  value: number
  image?: string
  category?: string
}

interface SelectedItem {
  id: string
  name: string
  image: string
  value: number
}

type OfferType = "cash" | "item_cash" | "item_coins" | "multi_trade"

const TYPE_TABS: { id: OfferType; label: string }[] = [
  { id: "cash", label: "Denaro" },
  { id: "item_cash", label: "Oggetto + denaro" },
  { id: "item_coins", label: "Oggetto + Coins" },
  { id: "multi_trade", label: "Scambio multiplo" },
]

function toSelected(i: CollectionItem): SelectedItem {
  return { id: i._id, name: i.name, image: i.image || "", value: Number(i.value) || 0 }
}

function fairness(offerValue: number, askValue: number) {
  const ask = Math.max(1, askValue)
  const ratio = offerValue / ask
  let verdict: "ottima" | "equa" | "sfavorevole" | "molto sfavorevole"
  if (ratio >= 1.1) verdict = "ottima"
  else if (ratio >= 0.9) verdict = "equa"
  else if (ratio >= 0.7) verdict = "sfavorevole"
  else verdict = "molto sfavorevole"
  return { ratio, pct: Math.round(ratio * 100), verdict }
}

const VERDICT_TONE: Record<string, string> = {
  ottima: "text-chart-2",
  equa: "text-foreground",
  sfavorevole: "text-chart-4",
  "molto sfavorevole": "text-destructive",
}

interface Props {
  token: string
  conversationId: string
  mode: "new" | "counter"
  originalMessageId?: string
  onClose: () => void
  onSent: () => void
}

export default function OfferComposer({ token, conversationId, mode, originalMessageId, onClose, onSent }: Props) {
  const [offerType, setOfferType] = useState<OfferType>("cash")
  const [amount, setAmount] = useState("")
  const [coins, setCoins] = useState("")
  const [note, setNote] = useState("")
  const [offered, setOffered] = useState<SelectedItem[]>([])
  const [requested, setRequested] = useState<SelectedItem[]>([])

  const [myItems, setMyItems] = useState<CollectionItem[]>([])
  const [otherItems, setOtherItems] = useState<CollectionItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadItems() {
      try {
        const [mine, others] = await Promise.all([
          fetch("/api/collections/list", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
          fetch("/api/collections/browse", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        ])
        if (mine.success) setMyItems(mine.items || [])
        if (others.success) setOtherItems(others.items || [])
      } catch {
        // Ignore.
      }
    }
    loadItems()
  }, [token])

  const toggle = useCallback((list: SelectedItem[], setList: (v: SelectedItem[]) => void, item: CollectionItem) => {
    const exists = list.find((x) => x.id === item._id)
    if (exists) setList(list.filter((x) => x.id !== item._id))
    else setList([...list, toSelected(item)])
  }, [])

  const offeredValue = useMemo(() => offered.reduce((s, i) => s + i.value, 0), [offered])
  const requestedValue = useMemo(() => requested.reduce((s, i) => s + i.value, 0), [requested])

  const offerValue = useMemo(() => {
    const a = Number(amount) || 0
    const c = Number(coins) || 0
    return a + c * COINS_TO_EUR + offeredValue
  }, [amount, coins, offeredValue])

  const askValue = requestedValue || Number(amount) || 1
  const fair = useMemo(() => fairness(offerValue, askValue), [offerValue, askValue])

  function validate(): string {
    if (offerType === "cash" && (Number(amount) || 0) <= 0) return "Inserisci un importo valido."
    if (offerType === "item_cash" && offered.length === 0) return "Seleziona almeno un oggetto da offrire."
    if (offerType === "item_coins" && offered.length === 0 && (Number(coins) || 0) <= 0)
      return "Aggiungi un oggetto o dei CollexCoins."
    if (offerType === "multi_trade" && offered.length === 0) return "Seleziona almeno un oggetto da offrire."
    return ""
  }

  async function submit() {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const endpoint = mode === "counter" ? "/api/messages/counteroffer" : "/api/messages/offer"
      const payload: Record<string, unknown> = {
        conversationId,
        offerType,
        amount: offerType === "cash" || offerType === "item_cash" ? Number(amount) || 0 : 0,
        coins: offerType === "item_coins" ? Number(coins) || 0 : 0,
        offeredItems: offerType === "cash" ? [] : offered,
        requestedItems: offerType === "multi_trade" ? requested : [],
        askValue,
        text: note.trim(),
      }
      if (mode === "counter" && originalMessageId) payload.messageId = originalMessageId

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        onSent()
        onClose()
      } else {
        setError(data.message || "Invio non riuscito.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setSubmitting(false)
    }
  }

  const showOffered = offerType !== "cash"
  const showRequested = offerType === "multi_trade"
  const showAmount = offerType === "cash" || offerType === "item_cash"
  const showCoins = offerType === "item_coins"

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            {mode === "counter" ? "Controproposta" : "Fai una proposta"}
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
            aria-label="Chiudi"
          >
            x
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
          {TYPE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setOfferType(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                offerType === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {showAmount && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Importo (€)</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
            </div>
          )}

          {showCoins && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">CollexCoins</label>
              <input
                type="number"
                min="0"
                value={coins}
                onChange={(e) => setCoins(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {`Valore stimato: € ${((Number(coins) || 0) * COINS_TO_EUR).toFixed(2)}`}
              </p>
            </div>
          )}

          {showOffered && (
            <ItemPicker
              title="I tuoi oggetti offerti"
              items={myItems}
              selected={offered}
              onToggle={(item) => toggle(offered, setOffered, item)}
              emptyText="Non hai oggetti in collezione."
            />
          )}

          {showRequested && (
            <ItemPicker
              title="Oggetti richiesti"
              items={otherItems}
              selected={requested}
              onToggle={(item) => toggle(requested, setRequested, item)}
              emptyText="Nessun oggetto disponibile dagli altri utenti."
            />
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Nota (opzionale)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Aggiungi un messaggio..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>

          {/* AI advisor preview */}
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Advisor</p>
            <p className="text-sm text-foreground">
              {`Valore offerto € ${offerValue.toFixed(2)} su € ${askValue.toFixed(2)} richiesti.`}
            </p>
            <p className={`text-sm font-medium ${VERDICT_TONE[fair.verdict]}`}>
              {`Equità: ${fair.verdict} (${fair.pct}%).`}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Annulla
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Invio..." : mode === "counter" ? "Invia controproposta" : "Invia proposta"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemPicker({
  title,
  items,
  selected,
  onToggle,
  emptyText,
}: {
  title: string
  items: CollectionItem[]
  selected: SelectedItem[]
  onToggle: (item: CollectionItem) => void
  emptyText: string
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {items.map((item) => {
            const isSelected = selected.some((x) => x.id === item._id)
            return (
              <button
                key={item._id}
                onClick={() => onToggle(item)}
                className={`flex flex-col gap-1 rounded-lg border p-2 text-left transition-colors ${
                  isSelected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"
                }`}
              >
                <span className="flex h-16 w-full items-center justify-center overflow-hidden rounded bg-muted">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No img</span>
                  )}
                </span>
                <span className="truncate text-xs font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">{`€ ${(Number(item.value) || 0).toLocaleString("it-IT")}`}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
