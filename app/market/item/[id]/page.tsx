"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Badge from "@/components/Badge"
import ContactChatButton from "@/components/chat/ContactChatButton"
import WishlistMatchBadge from "@/components/wishlist/WishlistMatchBadge"
import BoostButton from "@/components/boost/BoostButton"
import SellerRankingBadge from "@/components/marketplace/SellerRankingBadge"
import MarketplaceProPanel from "@/components/marketplace/MarketplaceProPanel"

type Listing = {
  _id: string
  sellerId: string
  sellerUsername: string
  sellerBadge: string
  itemName: string
  description: string
  category: string
  condition: string
  rarity: string
  year: number | null
  value: number
  image: string
  photos: string[]
  price: number
  aiSuggestedPrice: number
  acceptsTrade: boolean
  acceptsItemPlusCash: boolean
  acceptsItemPlusCoins: boolean
  savedCount: number
  status: string
}

type Advisor = { price: { suggested: number; min: number; max: number }; tips: string[] }
type MyItem = { _id: string; name: string; image?: string; value?: number | null }

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

const OFFER_TYPES = [
  { value: "offer", label: "Offerta in denaro" },
  { value: "trade", label: "Scambio" },
  { value: "item_cash", label: "Oggetto + denaro" },
  { value: "item_coins", label: "Oggetto + monete" },
]

export default function MarketItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)

  const [listing, setListing] = useState<Listing | null>(null)
  const [advisor, setAdvisor] = useState<Advisor | null>(null)
  const [saved, setSaved] = useState(false)
  const [following, setFollowing] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [activeImage, setActiveImage] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  // Offer form state
  const [showOffer, setShowOffer] = useState(false)
  const [offerType, setOfferType] = useState("offer")
  const [offerAmount, setOfferAmount] = useState("")
  const [offerCoins, setOfferCoins] = useState("")
  const [offerMessage, setOfferMessage] = useState("")
  const [myItems, setMyItems] = useState<MyItem[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [fairness, setFairness] = useState<{ verdict: string; message: string; score: number } | null>(null)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (!t) {
      router.replace("/login")
      return
    }
    setToken(t)
  }, [router])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/market/item?id=${id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setListing(data.listing)
        setAdvisor(data.advisor)
        setSaved(data.saved)
        setFollowing(data.following)
        setIsOwner(data.isOwner)
        setActiveImage(data.listing.image || (data.listing.photos?.[0] ?? ""))
        setError("")
      } else {
        setError(data.message || "Annuncio non trovato.")
      }
    } catch {
      setError("Impossibile caricare l'annuncio.")
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  // Load my collection items when an item-based offer type is selected.
  useEffect(() => {
    if (!token || !["trade", "item_cash", "item_coins"].includes(offerType) || myItems.length > 0) return
    fetch("/api/collections/list", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setMyItems(
            (d.items || []).map((it: Record<string, unknown>) => ({
              _id: String(it._id),
              name: String(it.name),
              image: it.image as string,
              value: it.value as number,
            })),
          )
        }
      })
      .catch(() => {})
  }, [token, offerType, myItems.length])

  const selectedItemObjects = useMemo(
    () => myItems.filter((it) => selectedItems.includes(it._id)),
    [myItems, selectedItems],
  )

  const offerValue = useMemo(() => {
    const itemsVal = selectedItemObjects.reduce((s, it) => s + (Number(it.value) || 0), 0)
    return (Number(offerAmount) || 0) + (Number(offerCoins) || 0) * 0.01 + itemsVal
  }, [offerAmount, offerCoins, selectedItemObjects])

  async function checkFairness() {
    if (!token || !listing) return
    try {
      const res = await fetch("/api/market/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: "fairness", askValue: listing.price, offerValue }),
      })
      const data = await res.json()
      if (data.success) setFairness(data.fairness)
    } catch {
      // non-blocking
    }
  }

  useEffect(() => {
    if (showOffer && listing) checkFairness()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerValue, showOffer])

  async function handleBuy() {
    if (!token || !listing) return
    setBusy(true)
    setMessage("")
    try {
      const res = await fetch("/api/market/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId: listing._id }),
      })
      const data = await res.json()
      setMessage(data.message || "")
      if (data.success) {
        router.push("/wallet/transactions")
      }
    } catch {
      setMessage("Errore di rete.")
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmitOffer() {
    if (!token || !listing) return
    setBusy(true)
    setMessage("")
    try {
      const res = await fetch("/api/market/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          listingId: listing._id,
          type: offerType,
          amount: Number(offerAmount) || 0,
          coins: Number(offerCoins) || 0,
          offeredItems: selectedItemObjects.map((it) => ({
            itemId: it._id,
            name: it.name,
            image: it.image,
            value: it.value,
          })),
          message: offerMessage,
        }),
      })
      const data = await res.json()
      setMessage(data.message || "")
      if (data.success) {
        setShowOffer(false)
        setOfferAmount("")
        setOfferCoins("")
        setOfferMessage("")
        setSelectedItems([])
      }
    } catch {
      setMessage("Errore di rete.")
    } finally {
      setBusy(false)
    }
  }

  async function toggleSave() {
    if (!token || !listing) return
    setSaved((s) => !s)
    await fetch("/api/market/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listingId: listing._id }),
    }).catch(() => setSaved((s) => !s))
  }

  async function toggleFollow() {
    if (!token || !listing) return
    setFollowing((f) => !f)
    await fetch("/api/market/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sellerId: listing.sellerId }),
    }).catch(() => setFollowing((f) => !f))
  }

  async function contactSeller() {
    if (!token || !listing) return
    setBusy(true)
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recipientId: listing.sellerId,
          text: `Ciao! Sono interessato al tuo annuncio "${listing.itemName}".`,
        }),
      })
      const data = await res.json()
      if (data.success && data.conversation?._id) {
        router.push(`/messages/${data.conversation._id}`)
      } else {
        router.push("/messages")
      }
    } catch {
      router.push("/messages")
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

  if (!listing) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Annuncio non trovato."}</p>
      </div>
    )
  }

  const gallery = [listing.image, ...(listing.photos || [])].filter(Boolean)
  const inputClass =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
  const sold = listing.status !== "active"

  return (
    <div className="py-10">
      <Link href="/market" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-200">
        ← Torna al marketplace
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
            {activeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeImage || "/placeholder.svg"} alt={listing.itemName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">Nessuna immagine</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {gallery.map((p, i) => (
                <button
                  key={`${p}-${i}`}
                  type="button"
                  onClick={() => setActiveImage(p)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                    activeImage === p ? "border-neutral-900 dark:border-neutral-100" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{listing.itemName}</h1>
            <Badge tier={listing.sellerBadge} />
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <Link href={`/u/${listing.sellerUsername}`} className="hover:underline">
              @{listing.sellerUsername}
            </Link>
            {!isOwner && (
              <button
                type="button"
                onClick={toggleFollow}
                className="rounded-md border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                {following ? "Segui già" : "Segui"}
              </button>
            )}
          </div>

          <SellerRankingBadge sellerId={listing.sellerId} className="mt-2" />

          {!isOwner && (
            <WishlistMatchBadge
              kind="marketplace"
              name={listing.itemName}
              category={listing.category}
              price={listing.price}
              rarity={listing.rarity}
              className="mt-4"
            />
          )}

          <p className="mt-4 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">{formatEUR(listing.price)}</p>
          {listing.aiSuggestedPrice ? (
            <p className="text-sm text-neutral-400">Prezzo AI consigliato: {formatEUR(listing.aiSuggestedPrice)}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {listing.category && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {listing.category}
              </span>
            )}
            {listing.condition && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {listing.condition}
              </span>
            )}
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {listing.rarity}
            </span>
            {listing.year ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {listing.year}
              </span>
            ) : null}
          </div>

          {listing.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {listing.description}
            </p>
          )}

          <MarketplaceProPanel
            itemName={listing.itemName}
            category={listing.category}
            listingId={listing._id}
            currentPrice={listing.price}
            isOwner={isOwner}
          />

          {/* AI buy advisor */}
          {advisor && !isOwner && (
            <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">AI Advisor</p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {advisor.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {message && (
            <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              {message}
            </p>
          )}

          {/* Actions */}
          {isOwner ? (
            <div className="mt-6 flex flex-col gap-3 rounded-lg border border-neutral-200 px-3 py-3 dark:border-neutral-800">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Questo è il tuo annuncio.</p>
              {!sold && (
                <div className="flex flex-col gap-2">
                  <BoostButton targetType="marketplace" targetId={listing._id} onActivated={load} />
                  <p className="text-xs text-neutral-400">
                    Aumenta la visibilità del tuo annuncio con un Boost in CollexCoins.
                  </p>
                </div>
              )}
            </div>
          ) : sold ? (
            <p className="mt-6 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              Questo annuncio non è più disponibile.
            </p>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleBuy}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                >
                  Compra ora
                </button>
                <button
                  type="button"
                  onClick={() => setShowOffer((s) => !s)}
                  className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  Fai un'offerta
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={toggleSave}
                  className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  {saved ? "Salvato" : "Salva annuncio"}
                </button>
                <button
                  type="button"
                  onClick={contactSeller}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  Chat venditore
                </button>
              </div>
              <ContactChatButton
                contextType="listing"
                contextId={listing._id}
                label="Chat sull'annuncio"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              />
            </div>
          )}

          {/* Offer panel */}
          {showOffer && !isOwner && !sold && (
            <div className="mt-5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Invia un'offerta</h2>

              <select
                value={offerType}
                onChange={(e) => {
                  setOfferType(e.target.value)
                  setSelectedItems([])
                }}
                className={`${inputClass} mt-3`}
              >
                {OFFER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              {(offerType === "offer" || offerType === "item_cash") && (
                <input
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="Importo in €"
                  className={`${inputClass} mt-3`}
                />
              )}

              {offerType === "item_coins" && (
                <input
                  type="number"
                  value={offerCoins}
                  onChange={(e) => setOfferCoins(e.target.value)}
                  placeholder="CollexCoins"
                  className={`${inputClass} mt-3`}
                />
              )}

              {["trade", "item_cash", "item_coins"].includes(offerType) && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Seleziona i tuoi oggetti da offrire
                  </p>
                  {myItems.length === 0 ? (
                    <p className="text-xs text-neutral-400">Nessun oggetto nella tua collezione.</p>
                  ) : (
                    <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
                      {myItems.map((it) => (
                        <label
                          key={it._id}
                          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(it._id)}
                            onChange={(e) =>
                              setSelectedItems((prev) =>
                                e.target.checked ? [...prev, it._id] : prev.filter((x) => x !== it._id),
                              )
                            }
                          />
                          <span className="flex-1 truncate">{it.name}</span>
                          <span className="text-xs text-neutral-400">{it.value ? formatEUR(Number(it.value)) : "—"}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <textarea
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                placeholder="Messaggio (facoltativo)"
                rows={2}
                className={`${inputClass} mt-3`}
              />

              {/* AI fairness */}
              {fairness && (
                <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs dark:bg-neutral-900/50">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    Equità AI: {fairness.verdict} ({fairness.score}/100)
                  </span>
                  <p className="mt-0.5 text-neutral-500 dark:text-neutral-400">{fairness.message}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmitOffer}
                disabled={busy}
                className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {busy ? "Invio..." : "Invia offerta"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
