"use client"

import { useState } from "react"
import {
  SectionHeader, Spinner, Toolbar, Select, TableShell, Th, Td, EmptyRow, Pagination,
  PlanPill, ActionBtn, useAdminData, adminPost, fmtNum, fmtDate,
} from "./shared"

interface Row {
  userId: string
  username: string
  email: string
  plan: string
  billingCycle: string
  signupBonusClaimed: boolean
  updatedAt: string
}

interface Resp {
  success: boolean
  subscriptions: Row[]
  total: number
  page: number
  pages: number
}

const PLANS = ["Base", "Gold", "Premium"]
const CYCLES = ["monthly", "yearly"]

export default function SubscriptionsSection() {
  const [plan, setPlan] = useState("")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")

  const { data, loading, error, reload } = useAdminData<Resp>(
    `/api/admin/subscriptions?plan=${plan}&page=${page}`,
    [plan, page],
  )

  async function changePlan(userId: string, toPlan: string, cycle: string) {
    setBusy(userId)
    setNotice("")
    const res = await adminPost<{ success: boolean; message?: string }>("/api/admin/subscriptions/action", {
      action: "set_plan", userId, plan: toPlan, cycle,
    })
    setBusy("")
    setNotice(res.message || (res.success ? "Piano aggiornato." : "Azione non riuscita."))
    if (res.success) reload()
  }

  return (
    <div>
      <SectionHeader title="Abbonamenti" description="Gestisci i piani degli utenti. Le modifiche sincronizzano badge, commissioni e bonus." />

      <Toolbar>
        <Select value={plan} onChange={(v) => { setPlan(v); setPage(1) }} options={[
          { value: "", label: "Tutti i piani" },
          ...PLANS.map((p) => ({ value: p, label: p })),
        ]} />
        {data && <span className="ml-auto text-sm text-muted-foreground">{fmtNum(data.total)} abbonamenti</span>}
      </Toolbar>

      {notice && <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{notice}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <>
          <TableShell head={<><Th>Utente</Th><Th>Piano attuale</Th><Th>Ciclo</Th><Th>Bonus</Th><Th>Aggiornato</Th><Th className="text-right">Cambia piano</Th></>}>
            {!data?.subscriptions.length ? (
              <EmptyRow colSpan={6} />
            ) : (
              data.subscriptions.map((s) => (
                <tr key={s.userId} className="hover:bg-muted/30">
                  <Td>
                    <div className="font-medium">@{s.username}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </Td>
                  <Td><PlanPill plan={s.plan} /></Td>
                  <Td className="text-xs">{s.billingCycle === "yearly" ? "Annuale" : "Mensile"}</Td>
                  <Td className="text-xs text-muted-foreground">{s.signupBonusClaimed ? "Riscattato" : "—"}</Td>
                  <Td className="text-xs text-muted-foreground">{fmtDate(s.updatedAt)}</Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {PLANS.filter((p) => p !== s.plan).map((p) => (
                        <ActionBtn key={p} disabled={busy === s.userId} onClick={() => changePlan(s.userId, p, s.billingCycle || CYCLES[0])}>
                          → {p}
                        </ActionBtn>
                      ))}
                    </div>
                  </Td>
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
