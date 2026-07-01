import { Suspense } from "react"
import type { Metadata } from "next"
import StoreClient from "./StoreClient"

export const metadata: Metadata = {
  title: "Store CollexCoins · CollexBase",
  description: "Acquista pacchetti di CollexCoins con sconti fino al 60%. 1 CollexCoin = € 0,05.",
}

export default function CoinsStorePage() {
  return (
    <Suspense fallback={null}>
      <StoreClient />
    </Suspense>
  )
}
