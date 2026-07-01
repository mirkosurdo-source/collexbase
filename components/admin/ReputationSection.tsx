"use client"

import Link from "next/link"
import {
  useAdminData,
  Spinner,
  StatCard,
  SectionHeader,
  Card,
  AdminAreaChart,
  fmtNum,
} from "./shared"

interface Row {
  userId: string
  name: string
  username: string
  avatar: string
  value: number
}
interface ReputationData {
  totals: { users: number; withReputation: number }
  leaderboards: {
    topReputation: Row[]
    topFollowed: Row[]
    topSales: Row[]
    topAi: Row[]
  }
  growth: { label: string; value: number }[]
}

function Leaderboard({ title, rows, unit }: { title: string; rows: Row[]; unit: string }) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Nessun dato.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={r.userId} className="flex items-center gap-3">
              <span className="w-5 text-right text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              {r.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatar || "/placeholder.svg"} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {r.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {r.username ? (
                  <Link href={`/profile/${r.username}`} className="block truncate text-sm font-medium text-foreground hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium text-foreground">{r.name}</span>
                )}
                {r.username && <p className="truncate text-xs text-muted-foreground">@{r.username}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {fmtNum(r.value)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

export default function ReputationSection() {
  const { data, loading, error } = useAdminData<ReputationData>("/api/admin/reputation")

  if (loading) return <Spinner label="Caricamento reputazione…" />
  if (error || !data) return <p className="py-8 text-center text-sm text-destructive">{error || "Errore."}</p>

  const { totals, leaderboards, growth } = data

  return (
    <div>
      <SectionHeader
        title="Reputazione e community"
        description="Classifiche utenti, badge e crescita della community."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Utenti totali" value={fmtNum(totals.users)} />
        <StatCard label="Con reputazione" value={fmtNum(totals.withReputation)} />
        <StatCard
          label="Copertura"
          value={`${totals.users ? Math.round((totals.withReputation / totals.users) * 100) : 0}%`}
        />
      </div>

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Crescita community (nuovi utenti)</h3>
        {growth.length > 0 ? (
          <AdminAreaChart data={growth} />
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">Nessun dato di crescita.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Leaderboard title="Top reputazione" rows={leaderboards.topReputation} unit="pt" />
        <Leaderboard title="Più seguiti" rows={leaderboards.topFollowed} unit="follower" />
        <Leaderboard title="Più vendite" rows={leaderboards.topSales} unit="vendite" />
        <Leaderboard title="Più valutazioni AI" rows={leaderboards.topAi} unit="AI" />
      </div>
    </div>
  )
}
