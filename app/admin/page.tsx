export const dynamic = "force-dynamic";

import { updateActivity } from "@/lib/updateActivity"
import User from "@/lib/models/User"
import { connectDB } from "@/lib/db"

export default async function AdminPage() {
  await updateActivity()
  await connectDB()

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const onlineUsers = await User.find({
    lastActive: { $gte: fiveMinutesAgo },
  })

  return (
    <div>
      <h1>Dashboard Admin</h1>
      <p style={{ fontSize: "20px", marginTop: "20px" }}>
        👤 Utenti online: <strong>{onlineUsers.length}</strong>
      </p>
      <ul style={{ marginTop: "10px" }}>
        {onlineUsers.map((u: any) => (
          <li key={u._id}>
            {u.name} ({u.email})
          </li>
        ))}
      </ul>
    </div>
  )
}
