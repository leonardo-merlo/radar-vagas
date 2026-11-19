import Link from "next/link";
import { Suspense } from "react";
import { FilterForm } from "@/components/vagas/filter-form";
import { TriageButtons } from "@/components/vagas/triage-buttons";
import { parseFilters, postedDate, SCOPE_LABEL, SENIORITY_LABEL, STATUS_LABEL, toSearch } from "@/lib/filters";
import { listJobs, PAGE_SIZE } from "@/lib/queries";

export default function JobsPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="mb-4 text-2xl">Vagas</h1>
      <Suspense fallback={<p className="text-tinta-fraca">Carregando vagas…</p>}>
        <Jobs searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Jobs({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const filters = parseFilters(await searchParams);
  const { jobs, total } = await listJobs(filters);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <FilterForm filters={filters} />
      <p className="mb-3 text-sm text-tinta-media">
        {total} {total === 1 ? "vaga" : "vagas"}
        {pages > 1 ? `, página ${filters.page} de ${pages}` : ""}
      </p>
      <div className="tabela-wrap">
        <table className="tabela" data-testid="tabela-vagas">
          <thead>
            <tr>
              <th>Vaga</th>
              <th>Nota</th>
              <th>Nível</th>
              <th>Publicada</th>
              <th>Fonte</th>
              <th>Remota</th>
              <th>Status</th>
              <th>Triagem</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const posted = postedDate(job.posted_at, job.first_seen_at);
              return (
              <tr key={job.id}>
                <th scope="row">
                  <Link href={`/vaga/${job.id}`} className="font-semibold text-tinta">
                    {job.title}
                  </Link>
                  <div className="text-tinta-media">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ""}
                  </div>
                  {job.score_reason ? <div className="mt-1 text-sm text-tinta-fraca">{job.score_reason}</div> : null}
                </th>
                <td className={`num ${job.score == null ? "text-tinta-fraca" : ""}`}>{job.score ?? "–"}</td>
                <td className={`centro text-sm ${job.seniority === "nao_definido" ? "text-tinta-fraca" : ""}`}>{SENIORITY_LABEL[job.seniority]}</td>
                <td className="num text-sm" title={posted.seenOnly ? "O site não informa a data; é o dia em que o radar viu a vaga" : undefined}>
                  {posted.date}
                  <div className="font-texto text-tinta-fraca">{posted.seenOnly ? `vista ${posted.relative}` : posted.relative}</div>
                </td>
                <td className="centro text-sm">
                  {job.sources.map((source) => (
                    <div key={source}>{source}</div>
                  ))}
                </td>
                <td className="centro text-sm">
                  {SCOPE_LABEL[job.remote_scope]}
                  <div className="text-tinta-fraca">{job.language?.toUpperCase() ?? ""}</div>
                </td>
                <td className="centro text-sm">{STATUS_LABEL[job.status]}</td>
                <td>
                  <TriageButtons id={job.id} status={job.status} />
                </td>
              </tr>
              );
            })}
            {jobs.length === 0 ? (
              <tr>
                <th scope="row" colSpan={8} className="text-tinta-fraca">
                  Nenhuma vaga com esses filtros.
                </th>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="mt-4 flex gap-3 text-sm">
          {filters.page > 1 ? <Link href={`/${toSearch(filters, { page: filters.page - 1 })}`}>Anterior</Link> : null}
          {filters.page < pages ? <Link href={`/${toSearch(filters, { page: filters.page + 1 })}`}>Próxima</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
