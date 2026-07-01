import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"

export async function GET() {
  await connectDB()

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const users = await User.find({
    lastActive: { $gte: fiveMinutesAgo },
  })

  return NextResponse.json({ users })
}
