import type { Metadata } from "next"
import AdvisorClient from "./AdvisorClient"

export const metadata: Metadata = {
  title: "CollexSpark · AI Advisor",
  description: "Il tuo consulente AI personale per collezione, marketplace, scambi, aste e wishlist.",
}

export default function AdvisorPage() {
  return <AdvisorClient />
}
