"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

/** Renders the Admin entry in the navbar only for users with admin access. */
export default function AdminNavLink() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) return
    fetch("/api/admin/check", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d?.admin)))
      .catch(() => setIsAdmin(false))
  }, [])

  if (!isAdmin) return null

  return (
    <li>
      <Link
        href="/admin"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
      >
        Admin
      </Link>
    </li>
  )
}
