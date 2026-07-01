import type { Metadata } from "next"
import AnalyticsPageClient from "./AnalyticsPageClient"

export const metadata: Metadata = {
  title: "Analytics Avanzati · Collex",
  description: "Trend della collezione, analisi di mercato, aste calde e insights AI in un'unica dashboard.",
}

export default function AnalyticsPage() {
  return <AnalyticsPageClient />
}
