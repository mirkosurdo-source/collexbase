import type { Metadata } from "next"
import WishlistClient from "./WishlistClient"

export const metadata: Metadata = {
  title: "Wishlist Intelligente · CollexSpark",
  description:
    "La tua lista dei desideri monitorata dall'AI: disponibilità, cali di prezzo e occasioni rare su marketplace, scambi e aste.",
}

export default function WishlistPage() {
  return <WishlistClient />
}
