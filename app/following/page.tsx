"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ListingCard, { type Listing } from "@/components/market/ListingCard"

interface FollowedSeller {
  userId: string
  username: string
  avatar: string
  listingCount: number
}

export default function FollowingPage() {
  const router = useRouter()
  const [sellers, setSellers] = useState<FollowedSeller[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }
    try {
      const res = await fetch("/api/market/following", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        router.push("/login")
        return
      }
      const data = await res.json()
      if (res.ok) {
        setSellers(data.sellers || [])
        setListings(data.listings || [])
      } else {
        setError(data.error || "Errore nel caricamento.")
      }
    } catch {
      setError("Errore di rete.")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Venditori seguiti</h1>
        <Link href="/market" className="text-sm text-muted-foreground hover:text-foreground">
          {"← Torna al mercato"}
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : sellers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">Non segui ancora nessun venditore.</p>
          <Link href="/market" className="mt-3 inline-block text-sm text-primary hover:underline">
            Esplora il mercato
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap gap-3">
            {sellers.map((seller) => (
              <Link
                key={seller.userId}
                href={`/u/${seller.username}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted"
              >
                {seller.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={seller.avatar || "/placeholder.svg"}
                    alt={seller.username}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                    {seller.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{seller.username}</p>
                  <p className="text-xs text-muted-foreground">{`${seller.listingCount} annunci attivi`}</p>
                </div>
              </Link>
            ))}
          </div>

          <h2 className="mb-4 text-lg font-semibold text-foreground">Annunci recenti</h2>
          {listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun annuncio recente dai venditori che segui.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard key={listing._id} listing={listing} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
