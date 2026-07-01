import SellerOrdersClient from "@/components/seller/SellerOrdersClient"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Ordini Venditore",
  description: "Gestisci spedizioni e completamento ordini.",
}

export default function SellerOrdersPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <SellerOrdersClient />
    </main>
  )
}
