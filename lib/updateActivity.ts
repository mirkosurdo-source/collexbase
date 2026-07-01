import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"

export async function updateActivity(req: Request) {
  const userId = getAuthUserId(req)

  if (!userId) return

  await connectDB()

  await User.findByIdAndUpdate(userId, {
    lastActive: new Date(),
  })
}
