import type { Metadata } from "next"
import type { ReactNode } from "react"
import AdminLayoutClient from "@/components/admin/AdminLayoutClient"

export const metadata: Metadata = {
  title: "Amministrazione · CollexBase",
  description: "Pannello di controllo per la gestione della piattaforma CollexBase.",
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
