import type { Metadata } from "next"
import GroupDetailClient from "./GroupDetailClient"

export const metadata: Metadata = {
  title: "Gruppo | CollexBase",
  description: "Feed, chat, membri e annunci del gruppo di collezionisti.",
}

export default async function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  return <GroupDetailClient groupId={groupId} />
}
