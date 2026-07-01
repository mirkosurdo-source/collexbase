"use client"

import { useEffect, useState } from "react"

export default function OnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState([])

  async function fetchOnlineUsers() {
    try {
      const res = await fetch("/api/online-users")
      const data = await res.json()
      setOnlineUsers(data.users)
    } catch (err) {
      console.error("Errore nel fetch utenti online:", err)
    }
  }

  useEffect(() => {
    fetchOnlineUsers() // primo caricamento
    const interval = setInterval(fetchOnlineUsers, 10000) // ogni 10 secondi
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Utenti online (tempo reale)</h2>
      <p style={{ fontSize: "20px" }}>
        👤 <strong>{onlineUsers.length}</strong> utenti online
      </p>

      <ul>
        {onlineUsers.map((u: any) => (
          <li key={u._id}>
            {u.name} ({u.email})
          </li>
        ))}
      </ul>
    </div>
  )
}
