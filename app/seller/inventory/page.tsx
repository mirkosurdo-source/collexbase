import SellerInventoryClient from "@/components/seller/SellerInventoryClient"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Inventario Venditore",
  description: "Crea e gestisci gli articoli in vendita.",
}

export default function SellerInventoryPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <SellerInventoryClient />
    </main>
  )
}
