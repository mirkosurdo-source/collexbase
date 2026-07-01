"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Card, StatCard, Toolbar, TextInput, Select, TableShell, Th, Td, EmptyRow,
  Pagination, useAdminData, fmtNum, fmtEUR, fmtDate,
} from "./shared"

interface EntryRow {
  id: string
  username: string
  itemName: string
  category: string
  maxPrice: number | null
  minCondition: string
  notifyEnabled: boolean
  createdAt: string
}
interface Resp {
  success: boolean
  totals: { totalEntries: number; alertsEnabled: number; alertRate: number; uniqueWishers: number }
  topItems: { name: string; count: number }[]
  topCategories: { category: string; count: number }[]
  entries: EntryRow[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export default function WishlistSection() {
  const [page, setPage] = useState(1)
  const [username, setUsername] = useState("")
  const [appliedUser, setAppliedUser] = useState("")
  const [category, setCategory] = useState("")

  const query = new URLSearchParams({ page: String(page) })
  if (appliedUser) query.set("username", appliedUser)
  if (category) query.set("category", category)

  const { data, loading, error } = useAdminData<Resp>(`/api/admin/wishlist?${query.toString()}`, [
    page, appliedUser, category,
  ])

  const categoryOptions = [
    { value: "", label: "Tutte le categorie" },
    ...(data?.topCategories || []).map((c) => ({ value: c.category, label: c.category })),
  ]

  function applyUserFilter() {
    setPage(1)
    setAppliedUser(username.trim())
  }

  return (
    <div>
      <SectionHeader
        title="Wishlist Intelligente"
        description="Desideri degli utenti, adozione degli alert e oggetti più richiesti dalla community."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Desideri totali" value={fmtNum(data?.totals.totalEntries || 0)} />
        <StatCard label="Utenti con wishlist" value={fmtNum(data?.totals.uniqueWishers || 0)} />
        <StatCard label="Alert attivi" value={fmtNum(data?.totals.alertsEnabled || 0)} />
        <StatCard label="% con alert" value={`${data?.totals.alertRate || 0}%`} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-medium text-foreground">Oggetti più desiderati</h3>
          <TableShell head={<><Th>Oggetto</Th><Th className="text-right">Desideri</Th></>}>
            {!data?.topItems.length ? (
              <EmptyRow colSpan={2} />
            ) : (
              data.topItems.map((t) => (
                <tr key={t.name} className="hover:bg-muted/30">
                  <Td className="font-medium">{t.name}</Td>
                  <Td className="text-right">{fmtNum(t.count)}</Td>
                </tr>
              ))
            )}
          </TableShell>
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-medium text-foreground">Categorie più desiderate</h3>
          <TableShell head={<><Th>Categoria</Th><Th className="text-right">Desideri</Th></>}>
            {!data?.topCategories.length ? (
              <EmptyRow colSpan={2} />
            ) : (
              data.topCategories.map((c) => (
                <tr key={c.category} className="hover:bg-muted/30">
                  <Td className="font-medium">{c.category}</Td>
                  <Td className="text-right">{fmtNum(c.count)}</Td>
                </tr>
              ))
            )}
          </TableShell>
        </Card>
      </div>

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
          value={category}
          onChange={(v) => {
            setPage(1)
            setCategory(v)
          }}
          options={categoryOptions}
        />
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell
            head={<><Th>Utente</Th><Th>Oggetto</Th><Th>Categoria</Th><Th className="text-right">Prezzo max</Th><Th>Cond. min</Th><Th>Alert</Th><Th>Data</Th></>}
          >
            {!data?.entries.length ? (
              <EmptyRow colSpan={7} />
            ) : (
              data.entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <Td className="font-medium">@{e.username}</Td>
                  <Td>{e.itemName}</Td>
                  <Td className="text-muted-foreground">{e.category}</Td>
                  <Td className="text-right">{e.maxPrice != null ? fmtEUR(e.maxPrice) : "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{e.minCondition}</Td>
                  <Td className="text-xs">{e.notifyEnabled ? "Attivi" : "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{fmtDate(e.createdAt)}</Td>
                </tr>
              ))
            )}
          </TableShell>
          <Pagination page={data?.pagination.page || 1} pages={data?.pagination.pages || 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
