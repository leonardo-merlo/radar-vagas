import { PERIODS, SCOPE_LABEL, SENIORITY_LABEL, SORTS, SOURCES, STATUS_LABEL, type JobFilters } from "@/lib/filters";

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-tinta-media">
      {label}
      <select className="campo" name={name} defaultValue={value}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterForm({ filters }: { filters: JobFilters }) {
  return (
    <form method="get" className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11" data-testid="filtros">
      <Select
        name="status"
        label="Status"
        value={filters.status}
        options={[["abertas", "Abertas"], ["todas", "Todas"], ...Object.entries(STATUS_LABEL)]}
      />
      <Select name="remota" label="Remota" value={filters.scope} options={[["todas", "Todas"], ...Object.entries(SCOPE_LABEL)]} />
      <Select name="nivel" label="Nível" value={filters.seniority} options={[["todos", "Todos"], ...Object.entries(SENIORITY_LABEL)]} />
      <Select name="idioma" label="Idioma" value={filters.language} options={[["todas", "Todos"], ["pt", "Português"], ["en", "Inglês"]]} />
      <Select name="fonte" label="Fonte" value={filters.source} options={[["todas", "Todas"], ...SOURCES.map((source): [string, string] => [source, source])]} />
      <Select name="periodo" label="Coletada em" value={filters.period} options={Object.entries(PERIODS)} />
      <Select name="ordem" label="Ordenar por" value={filters.sort} options={Object.entries(SORTS)} />
      <label className="flex flex-col gap-1 text-xs text-tinta-media">
        Nota mínima
        <input className="campo" type="number" name="nota" min={0} max={100} step={5} defaultValue={filters.minScore || ""} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-tinta-media">
        Local
        <input className="campo" type="text" name="local" placeholder="São Paulo, Europe" defaultValue={filters.location} />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-xs text-tinta-media">
        Cargo ou empresa
        <span className="flex gap-2">
          <input className="campo w-full min-w-0" type="search" name="q" defaultValue={filters.query} />
          <button className="botao botao-principal" type="submit">
            Filtrar
          </button>
        </span>
      </label>
    </form>
  );
}
