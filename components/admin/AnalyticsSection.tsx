"use client"

import {
  useAdminData,
  Spinner,
  StatCard,
  SectionHeader,
  TableShell,
  Th,
  Td,
  EmptyRow,
  fmtNum,
} from "@/components/admin/shared"
import ValueLineChart from "@/components/charts/ValueLineChart"
import CategoryBarChart from "@/components/charts/CategoryBarChart"

interface PlatformAnalyticsResponse {
  success: boolean
  totals: {
    snapshots: number
    activeUsers: number
    avgCollectionValue: number
    totalCollectionValue: number
  }
  topCategories: { category: string; volume: number; value: number }[]
  engagement: { day: string; users: number; value: number }[]
  marketOverview: {
    categories: { category: string; avgValue: number; volume: number; trend7d: number; trend30d: number }[]
    rising: { category: string; trend7d: number }[]
    falling: { category: string; trend7d: number }[]
  }
}

export default function AnalyticsSection() {
  const { data, loading } = useAdminData<PlatformAnalyticsResponse>("/api/admin/analytics")

  if (loading) return <Spinner />
  if (!data?.success) return <p className="text-sm text-muted-foreground">Impossibile caricare gli analytics.</p>

  const valueSeries = data.engagement.map((e) => ({ label: e.day.slice(5), value: e.value }))
  const userSeries = data.engagement.map((e) => ({ label: e.day.slice(5), value: e.users }))
  const categoryBars = data.topCategories.map((c) => ({ category: c.category, value: c.value, count: c.volume }))

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Analytics piattaforma" description="Dati aggregati e anonimi su tutta la piattaforma" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Utenti attivi" value={fmtNum(data.totals.activeUsers)} />
        <StatCard label="Snapshot totali" value={fmtNum(data.totals.snapshots)} />
        <StatCard label="Valore medio collezione" value={fmtNum(data.totals.avgCollectionValue)} />
        <StatCard label="Valore totale piattaforma" value={fmtNum(data.totals.totalCollectionValue)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Valore aggregato (14 giorni)</h3>
          <ValueLineChart data={valueSeries} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Utenti attivi (14 giorni)</h3>
          <ValueLineChart data={userSeries} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Top categorie per valore</h3>
        <CategoryBarChart data={categoryBars} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Dettaglio categorie</h3>
        <TableShell head={<tr><Th>Categoria</Th><Th>Volume</Th><Th>Valore</Th></tr>}>
          {data.topCategories.length === 0 ? (
            <EmptyRow colSpan={3} text="Nessun dato di categoria." />
          ) : (
            data.topCategories.map((c) => (
              <tr key={c.category} className="border-t border-border">
                <Td>{c.category}</Td>
                <Td>{fmtNum(c.volume)}</Td>
                <Td>{fmtNum(c.value)}</Td>
              </tr>
            ))
          )}
        </TableShell>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Categorie in crescita</h3>
          {data.marketOverview.rising.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {data.marketOverview.rising.map((r) => (
                <li key={r.category} className="flex justify-between">
                  <span className="text-foreground">{r.category}</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">+{r.trend7d}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna categoria in crescita.</p>
          )}
        </div>
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Categorie in calo</h3>
          {data.marketOverview.falling.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {data.marketOverview.falling.map((r) => (
                <li key={r.category} className="flex justify-between">
                  <span className="text-foreground">{r.category}</span>
                  <span className="font-medium text-rose-700 dark:text-rose-300">{r.trend7d}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna categoria in calo.</p>
          )}
        </div>
      </div>
    </div>
  )
}
