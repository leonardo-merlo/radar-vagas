import nodemailer from "nodemailer";
import { requireEnv } from "../config.js";
import type { JobRow } from "../db/database.types.js";

export interface SourceSummary {
  source: string;
  ok: boolean;
  fetched: number;
  kept: number;
  inserted: number;
  error?: string;
}

export interface DigestInput {
  date: string;
  newJobs: JobRow[];
  topN: number;
  cutoff: number;
  sources: SourceSummary[];
  scoredCount: number;
  unscoredLeft: number;
}

const APPLY_LABEL: Record<JobRow["apply_type"], string> = {
  easy_apply: "Easy Apply",
  form: "Formulário",
  email: "E-mail",
  external: "Site externo",
  unknown: "?",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}

export function topJobs(jobs: JobRow[], topN: number): JobRow[] {
  return jobs
    .filter((job) => job.status !== "skipped")
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, topN);
}

export function renderDigest(input: DigestInput): { subject: string; html: string; text: string } {
  const top = topJobs(input.newJobs, input.topN);
  const aboveCutoff = input.newJobs.filter((job) => (job.score ?? 0) >= input.cutoff && job.status !== "skipped").length;
  const failed = input.sources.filter((source) => !source.ok);

  const rows = top
    .map(
      (job) => `<tr>
  <td style="padding:6px 8px;font-weight:600;text-align:right">${job.score ?? "–"}</td>
  <td style="padding:6px 8px"><a href="${escapeHtml(job.url)}">${escapeHtml(job.title)}</a><br>
  <span style="color:#555">${escapeHtml(job.company)} · ${escapeHtml(job.source)} · ${APPLY_LABEL[job.apply_type]}</span><br>
  <span style="color:#777;font-size:13px">${escapeHtml(job.score_reason ?? "sem nota ainda")}</span></td>
</tr>`,
    )
    .join("\n");

  const sourceRows = input.sources
    .map(
      (source) => `<tr>
  <td style="padding:3px 8px">${escapeHtml(source.source)}</td>
  <td style="padding:3px 8px;text-align:right">${source.ok ? source.fetched : "–"}</td>
  <td style="padding:3px 8px;text-align:right">${source.ok ? source.kept : "–"}</td>
  <td style="padding:3px 8px;text-align:right">${source.ok ? source.inserted : "–"}</td>
  <td style="padding:3px 8px;color:${source.ok ? "#2a7" : "#c33"}">${source.ok ? "ok" : escapeHtml(source.error ?? "falhou")}</td>
</tr>`,
    )
    .join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;max-width:720px;color:#222">
<h2 style="margin:0 0 4px">Radar de Vagas · ${input.date}</h2>
<p style="margin:0 0 16px">${input.newJobs.length} vagas novas · ${aboveCutoff} acima da nota de corte (${input.cutoff}) · ${input.scoredCount} avaliadas hoje${input.unscoredLeft > 0 ? ` · ${input.unscoredLeft} ainda sem nota` : ""}</p>
<h3>Top ${top.length} por nota</h3>
<table style="border-collapse:collapse;width:100%">${rows || "<tr><td>Nenhuma vaga nova hoje.</td></tr>"}</table>
<h3>Por fonte</h3>
<table style="border-collapse:collapse;font-size:14px">
<tr style="color:#666"><th style="text-align:left;padding:3px 8px">Fonte</th><th style="padding:3px 8px">Coletadas</th><th style="padding:3px 8px">Remotas p/ você</th><th style="padding:3px 8px">Novas</th><th style="text-align:left;padding:3px 8px">Status</th></tr>
${sourceRows}
</table>
${failed.length ? `<p style="color:#c33">Fontes que falharam: ${failed.map((source) => escapeHtml(source.source)).join(", ")}</p>` : ""}
<p style="color:#888;font-size:12px">Para se candidatar: rode "aplica nas vagas" no Claude com o Chrome logado.</p>
</div>`;

  const text = [
    `Radar de Vagas ${input.date}: ${input.newJobs.length} novas, ${aboveCutoff} acima de ${input.cutoff}.`,
    "",
    ...top.map((job) => `${job.score ?? "-"} | ${job.title} | ${job.company} | ${job.url}`),
    "",
    ...input.sources.map((source) => `${source.source}: ${source.ok ? `${source.inserted} novas` : `FALHOU (${source.error})`}`),
  ].join("\n");

  return { subject: `Radar de Vagas ${input.date}: ${input.newJobs.length} novas, ${aboveCutoff} acima de ${input.cutoff}`, html, text };
}

export async function sendDigest(message: { subject: string; html: string; text: string }): Promise<void> {
  const user = requireEnv("GMAIL_USER");
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: requireEnv("GMAIL_APP_PASSWORD") },
  });
  await transport.sendMail({
    from: `Radar de Vagas <${user}>`,
    to: process.env.DIGEST_TO || user,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
