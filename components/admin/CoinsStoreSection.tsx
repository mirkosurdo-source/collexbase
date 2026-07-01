"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Card, StatCard, Toolbar, TextInput, Select, TableShell, Th, Td, EmptyRow,
  Pagination, PlanPill, useAdminData, fmtNum, fmtEUR, fmtDate, AdminAreaChart,
} from "./shared"

interface Purchase {
  id: string
  username: string
  packageId: string
  coins: number
  tier: string
  finalPrice: number
  savings: number
  totalDiscountPct: number
  createdAt: string
}
interface PackageRow { packageId: string; coins: number; count: number; revenue: number; coinsSold: number }
interface Resp {
  success: boolean
  page: number
  pages: number
  total: number
  totals: { revenue: number; coinsSold: number; count: number }
  byPackage: PackageRow[]
  trend: { label: string; value: number }[]
  packages: { id: string; coins: number }[]
  purchases: Purchase[]
}

export default function CoinsStoreSection() {
  const [page, setPage] = useState(1)
  const [username, setUsername] = useState("")
  const [appliedUser, setAppliedUser] = useState("")
  const [packageId, setPackageId] = useState("")

  const query = new URLSearchParams({ page: String(page) })
  if (appliedUser) query.set("username", appliedUser)
  if (packageId) query.set("packageId", packageId)

  const { data, loading, error } = useAdminData<Resp>(`/api/admin/coins-store?${query.toString()}`, [
    page, appliedUser, packageId,
  ])

  const packageOptions = [
    { value: "", label: "Tutti i pacchetti" },
    ...(data?.packages || []).map((p) => ({ value: p.id, label: `${fmtNum(p.coins)} coins` })),
  ]

  function applyUserFilter() {
    setPage(1)
    setAppliedUser(username.trim())
  }

  return (
    <div>
      <SectionHeader
        title="Store CollexCoins"
        description="Acquisti di pacchetti monete, ricavi totali e andamento delle vendite."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ricavi totali" value={fmtEUR(data?.totals.revenue || 0)} />
        <StatCard label="Monete vendute" value={fmtNum(data?.totals.coinsSold || 0)} />
        <StatCard label="Acquisti" value={fmtNum(data?.totals.count || 0)} />
        <StatCard
          label="Scontrino medio"
          value={fmtEUR(data?.totals.count ? (data.totals.revenue || 0) / data.totals.count : 0)}
        />
      </div>

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-foreground">Vendite (ultimi 14 giorni)</h3>
        <AdminAreaChart data={data?.trend || []} />
      </Card>

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-foreground">Per pacchetto</h3>
        <TableShell
          head={<><Th>Pacchetto</Th><Th className="text-right">Acquisti</Th><Th className="text-right">Monete vendute</Th><Th className="text-right">Ricavi</Th></>}
        >
          {!data?.byPackage.length ? (
            <EmptyRow colSpan={4} />
          ) : (
            data.byPackage.map((b) => (
              <tr key={b.packageId} className="hover:bg-muted/30">
                <Td className="font-medium">{fmtNum(b.coins)} coins</Td>
                <Td className="text-right">{fmtNum(b.count)}</Td>
                <Td className="text-right">{fmtNum(b.coinsSold)}</Td>
                <Td className="text-right font-medium">{fmtEUR(b.revenue)}</Td>
              </tr>
            ))
          )}
        </TableShell>
      </Card>

      <Toolbar>
        <TextInput value={username} onChange={setUsername} placeholder="filtra per username" />
        <button
          type="button"
          onClick={applyUserFilter}
          className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Filtra
        </button>
        <Select
          value={packageId}
          onChange={(v) => {
            setPage(1)
            setPackageId(v)
          }}
          options={packageOptions}
        />
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell
            head={<><Th>Utente</Th><Th>Pacchetto</Th><Th>Piano</Th><Th className="text-right">Prezzo</Th><Th className="text-right">Sconto</Th><Th>Data</Th></>}
          >
            {!data?.purchases.length ? (
              <EmptyRow colSpan={6} />
            ) : (
              data.purchases.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <Td className="font-medium">@{p.username}</Td>
                  <Td>{fmtNum(p.coins)} coins</Td>
                  <Td><PlanPill plan={p.tier} /></Td>
                  <Td className="text-right font-medium">{fmtEUR(p.finalPrice)}</Td>
                  <Td className="text-right text-xs text-muted-foreground">
                    {p.totalDiscountPct > 0 ? `-${p.totalDiscountPct}%` : "—"}
                  </Td>
                  <Td className="text-xs text-muted-foreground">{fmtDate(p.createdAt)}</Td>
                </tr>
              ))
            )}
          </TableShell>
          <Pagination page={data?.page || 1} pages={data?.pages || 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
