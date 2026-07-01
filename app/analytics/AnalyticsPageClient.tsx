"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import CollexSpark from "@/components/collexspark/CollexSpark"
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard"

export default function AnalyticsPageClient() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login?redirect=/analytics")
      return
    }
    setReady(true)
  }, [router])

  if (!ready) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Caricamento...</p>
  }

  return (
    <div className="py-8">
      <section className="mb-6 flex flex-col items-center gap-6 rounded-2xl border border-spark/20 bg-spark-muted/40 p-6 sm:flex-row sm:items-center sm:p-8">
        <CollexSpark pose="trend" size="lg" still />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-spark">Analytics Avanzati</p>
          <h1 className="mt-1 text-balance text-2xl font-bold text-foreground sm:text-3xl">
            La tua dashboard professionale
          </h1>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">
            Valore della collezione, trend di mercato, aste calde e insights AI: tutto in un colpo d&apos;occhio.
          </p>
        </div>
      </section>

      <AnalyticsDashboard embedded />
    </div>
  )
}
