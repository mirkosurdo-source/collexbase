"use client"

export type Filters = {
  query: string
  category: string
  condition: string
  yearMin: string
  yearMax: string
  valueMin: string
  valueMax: string
  sort: string
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  category: "",
  condition: "",
  yearMin: "",
  yearMax: "",
  valueMin: "",
  valueMax: "",
  sort: "name_asc",
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:focus:border-neutral-400"

const labelClass = "mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400"

export default function CollectionFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters
  onChange: (next: Partial<Filters>) => void
  onReset: () => void
}) {
  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Search bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="query" className={labelClass}>
            Ricerca
          </label>
          <input
            id="query"
            type="text"
            placeholder="Cerca per nome, categoria, anno o stato..."
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="sort" className={labelClass}>
            Ordina per
          </label>
          <select
            id="sort"
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
            className={inputClass}
          >
            <option value="name_asc">Nome A → Z</option>
            <option value="name_desc">Nome Z → A</option>
            <option value="value_asc">Valore crescente</option>
            <option value="value_desc">Valore decrescente</option>
            <option value="year_asc">Anno crescente</option>
            <option value="year_desc">Anno decrescente</option>
          </select>
        </div>
      </div>

      {/* Advanced filters */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <label htmlFor="category" className={labelClass}>
            Categoria
          </label>
          <input
            id="category"
            type="text"
            placeholder="Es. Monete"
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <label htmlFor="condition" className={labelClass}>
            Stato
          </label>
          <input
            id="condition"
            type="text"
            placeholder="Es. Ottimo"
            value={filters.condition}
            onChange={(e) => onChange({ condition: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="yearMin" className={labelClass}>
            Anno min
          </label>
          <input
            id="yearMin"
            type="number"
            value={filters.yearMin}
            onChange={(e) => onChange({ yearMin: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="yearMax" className={labelClass}>
            Anno max
          </label>
          <input
            id="yearMax"
            type="number"
            value={filters.yearMax}
            onChange={(e) => onChange({ yearMax: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="valueMin" className={labelClass}>
            Valore min (€)
          </label>
          <input
            id="valueMin"
            type="number"
            value={filters.valueMin}
            onChange={(e) => onChange({ valueMin: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="valueMax" className={labelClass}>
            Valore max (€)
          </label>
          <input
            id="valueMax"
            type="number"
            value={filters.valueMax}
            onChange={(e) => onChange({ valueMax: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Reimposta filtri
        </button>
      </div>
    </div>
  )
}
