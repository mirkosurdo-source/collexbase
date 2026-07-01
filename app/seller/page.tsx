import SellerDashboardClient from "@/components/seller/SellerDashboardClient"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Dashboard Venditore",
  description: "Gestisci vendite, ordini, payout e inventario come Venditore Professionista.",
}

export default function SellerPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <SellerDashboardClient />
    </main>
  )
}
