import { notFound } from "next/navigation"
import ContextChatClient from "./ContextChatClient"

const VALID_CONTEXTS = ["trade", "listing", "auction"]

export default async function ContextChatPage({
  params,
}: {
  params: Promise<{ context: string; id: string }>
}) {
  const { context, id } = await params
  if (!VALID_CONTEXTS.includes(context)) notFound()
  return <ContextChatClient context={context} id={id} />
}
