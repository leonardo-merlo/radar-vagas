import Link from "next/link";
import { Suspense } from "react";
import { parseFilters, PERIODS, type Period } from "@/lib/filters";
import { getMetrics } from "@/lib/queries";

export default function MetricsPage({ searchParams }: PageProps<"/metricas">) {
  return (
    <>
      <h1 className="mb-4 text-2xl">Métricas</h1>
      <Suspense fallback={<p className="text-tinta-fraca">Calculando…</p>}>
        <Metrics searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function shortDate(day: string): string {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

async function Metrics({ searchParams }: { searchParams: PageProps<"/metricas">["searchParams"] }) {
  const { period } = parseFilters(await searchParams);
  const metrics = await getMetrics(period);
  const { totals } = metrics;
  const maxDay = Math.max(1, ...metrics.by_day.map((day) => day.collected));

  return (
    <>
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Período">
        {(Object.entries(PERIODS) as [Period, string][]).map(([value, label]) => (
          <Link
            key={value}
            href={value === "30" ? "/metricas" : `/metricas?periodo=${value}`}
            className={`botao no-underline ${value === period ? "botao-principal" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="tabela-wrap mb-6">
        <table className="tabela" data-testid="funil">
          <thead>
            <tr>
              <th>Funil do período</th>
              <th>Vagas</th>
            </tr>
          </thead>
          <tbody>
            <tr className="linha-forte">
              <th scope="row">Candidaturas enviadas</th>
              <td className="num">{metrics.applied_in_period}</td>
            </tr>
            <tr>
              <th scope="row">Coletadas (sem repetição entre fontes)</th>
              <td className="num">{totals.collected}</td>
            </tr>
            <tr>
              <th scope="row">Com nota 70 ou mais</th>
              <td className="num">{totals.above_70}</td>
            </tr>
            <tr>
              <th scope="row">Aprovadas, aguardando candidatura</th>
              <td className="num">{totals.approved}</td>
            </tr>
            <tr>
              <th scope="row">Pendentes de você (login, teste, pergunta)</th>
              <td className={`num ${totals.pending_me === 0 ? "text-tinta-fraca" : ""}`}>{totals.pending_me}</td>
            </tr>
            <tr>
              <th scope="row">Falharam</th>
              <td className={`num ${totals.failed > 0 ? "text-erro" : "text-tinta-fraca"}`}>{totals.failed}</td>
            </tr>
            <tr>
              <th scope="row">Contatos encontrados · chamados · responderam</th>
              <td className="num">
                {metrics.contacts.found} · {metrics.contacts.contacted} · {metrics.contacts.replied}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg">Por fonte</h2>
      <div className="tabela-wrap mb-6">
        <table className="tabela" data-testid="por-fonte">
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Coletadas</th>
              <th>Nota 70+</th>
              <th>Nota média</th>
              <th>Candidatadas</th>
              <th>Última coleta</th>
            </tr>
          </thead>
          <tbody>
            {metrics.last_runs
              .map((run) => ({ run, stats: metrics.by_source.find((source) => source.source === run.source) }))
              .sort((a, b) => (b.stats?.collected ?? 0) - (a.stats?.collected ?? 0))
              .map(({ run, stats }) => (
                <tr key={run.source}>
                  <th scope="row">
                    <Link href={`/?fonte=${run.source}&status=todas&periodo=${period}`}>{run.source}</Link>
                  </th>
                  <td className="num">{stats?.collected ?? 0}</td>
                  <td className="num">{stats?.above_70 ?? 0}</td>
                  <td className="num">{stats?.avg_score ?? "–"}</td>
                  <td className="num">{stats?.applied ?? 0}</td>
                  <td className={`centro text-sm ${run.ok ? "" : "text-erro"}`} title={run.error ?? undefined}>
                    {run.ok ? `ok, ${run.inserted} novas` : "falhou"}
                  </td>
                </tr>
              ))}
            {metrics.last_runs.length === 0 ? (
              <tr>
                <th scope="row" colSpan={6} className="text-tinta-fraca">
                  Nenhuma coleta registrada ainda.
                </th>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg">Por dia</h2>
      <div className="tabela-wrap">
        <table className="tabela" data-testid="por-dia">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Coletadas</th>
              <th>Nota 70+</th>
              <th>Candidaturas</th>
            </tr>
          </thead>
          <tbody>
            {metrics.by_day.map((day) => (
              <tr key={day.day}>
                <th scope="row">
                  <div className="flex items-center gap-3">
                    <span className="cod">{shortDate(day.day)}</span>
                    <span className="barra" style={{ width: `${Math.round((day.collected / maxDay) * 100)}%` }} />
                  </div>
                </th>
                <td className="num">{day.collected}</td>
                <td className="num">{day.above_70}</td>
                <td className="num">{day.applied}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
