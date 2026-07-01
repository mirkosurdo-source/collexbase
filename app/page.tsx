export default function HomePage() {
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Benvenuto su CollexBase
      </h1>
      <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
        CollexBase è la piattaforma dedicata ai collezionisti: gestisci il tuo
        inventario, scambia oggetti, partecipa alle aste e connettiti con la
        community. Questo è il fondamento del progetto, una base stabile e
        pulita su cui costruire tutto il resto.
      </p>
    </section>
  )
}
