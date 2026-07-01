"use client"

import Link from "next/link"
import Badge from "@/components/Badge"
import BoostBadge from "@/components/boost/BoostBadge"
import type { BoostTier } from "@/lib/models/BoostActivation"

export interface Listing {
  _id: string
  itemName: string
  category?: string
  image?: string
  price: number
  aiSuggestedPrice?: number
  sellerUsername?: string
  sellerBadge?: string
  acceptsTrade?: boolean
  acceptsItemPlusCash?: boolean
  acceptsItemPlusCoins?: boolean
  savedCount?: number
  saved?: boolean
  boostTier?: BoostTier
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

export default function ListingCard({
  listing,
  onToggleSave,
}: {
  listing: Listing
  onToggleSave?: (id: string) => void
}) {
  const modes: string[] = []
  if (listing.acceptsTrade) modes.push("Scambio")
  if (listing.acceptsItemPlusCash) modes.push("Oggetto + €")
  if (listing.acceptsItemPlusCoins) modes.push("Oggetto + coins")

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-colors dark:bg-neutral-950 ${
        listing.boostTier
          ? "border-amber-400 ring-1 ring-amber-300 hover:border-amber-500 dark:border-amber-600 dark:ring-amber-800"
          : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
      }`}
    >
      <Link href={`/market/item/${listing._id}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {listing.boostTier && (
            <div className="absolute left-2 top-2 z-10">
              <BoostBadge tier={listing.boostTier} />
            </div>
          )}
          {listing.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.image || "/placeholder.svg"} alt={listing.itemName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
              Nessuna immagine
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/market/item/${listing._id}`} className="min-w-0">
            <h3 className="truncate font-medium text-neutral-900 dark:text-neutral-50">{listing.itemName}</h3>
          </Link>
          {onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(listing._id)}
              aria-label={listing.saved ? "Rimuovi dai salvati" : "Salva annuncio"}
              className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                listing.saved
                  ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              }`}
            >
              {listing.saved ? "Salvato" : "Salva"}
            </button>
          )}
        </div>

        {listing.category && (
          <span className="mt-1 inline-block w-fit rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {listing.category}
          </span>
        )}

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{formatEUR(listing.price)}</p>
            {listing.aiSuggestedPrice ? (
              <p className="text-xs text-neutral-400">AI: {formatEUR(listing.aiSuggestedPrice)}</p>
            ) : null}
          </div>
          {listing.sellerUsername && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">@{listing.sellerUsername}</span>
              {listing.sellerBadge && <Badge tier={listing.sellerBadge} />}
            </div>
          )}
        </div>

        {modes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {modes.map((m) => (
              <span
                key={m}
                className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
