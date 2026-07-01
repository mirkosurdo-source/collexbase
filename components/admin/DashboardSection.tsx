"use client"

import { StatCard, SectionHeader, Card, Spinner, useAdminData, fmtEUR, fmtNum, AdminAreaChart, AdminBarChart } from "./shared"

interface DashboardData {
  success: boolean
  stats: {
    totalUsers: number
    blockedUsers: number
    subscriptions: Record<string, number>
    activeSubscriptions: number
    collexCoinTotal: number
    walletTotal: number
    walletAvailable: number
    walletPending: number
    walletBlocked: number
    escrowTotal: number
    transactionsToday: number
    activeTrades: number
    activeAuctions: number
    activeListings: number
    soldListings: number
    openDisputes: number
  }
  charts: {
    transactionsSeries: { label: string; volume: number; count: number }[]
    subscriptionsByTier: { category: string; value: number }[]
  }
}

export default function DashboardSection() {
  const { data, loading, error } = useAdminData<DashboardData>("/api/admin/dashboard")

  if (loading) return <Spinner />
  if (error || !data?.stats) return <p className="text-sm text-muted-foreground">{error || "Impossibile caricare i dati."}</p>

  const { stats, charts } = data
  const volumeSeries = charts.transactionsSeries.map((p) => ({ label: p.label, value: p.volume }))

  return (
    <div>
      <SectionHeader title="Panoramica" description="Metriche aggregate dell'intera piattaforma CollexBase." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Utenti totali" value={fmtNum(stats.totalUsers)} hint={`${fmtNum(stats.blockedUsers)} bloccati`} />
        <StatCard label="Abbonamenti attivi" value={fmtNum(stats.activeSubscriptions)} hint="Gold + Premium" />
        <StatCard label="Collex Coin in circolo" value={fmtNum(stats.collexCoinTotal)} hint="saldo aggregato" />
        <StatCard label="Transazioni oggi" value={fmtNum(stats.transactionsToday)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saldo wallet totale" value={fmtEUR(stats.walletTotal)} hint={`Disponibile ${fmtEUR(stats.walletAvailable)}`} />
        <StatCard label="In escrow" value={fmtEUR(stats.escrowTotal)} hint={`${fmtNum(stats.openDisputes)} dispute aperte`} />
        <StatCard label="Annunci attivi" value={fmtNum(stats.activeListings)} hint={`${fmtNum(stats.soldListings)} venduti`} />
        <StatCard label="Aste attive" value={fmtNum(stats.activeAuctions)} hint={`${fmtNum(stats.activeTrades)} scambi in corso`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-medium text-foreground">Volume transazioni (14 giorni)</h3>
          <AdminAreaChart data={volumeSeries} />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-medium text-foreground">Distribuzione abbonamenti</h3>
          <AdminBarChart data={charts.subscriptionsByTier} />
        </Card>
      </div>
    </div>
  )
}
