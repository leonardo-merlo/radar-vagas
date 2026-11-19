import { existsSync, readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { RadarConfig } from "../config.js";
import type { JobRow } from "../db/database.types.js";

export const ScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  reason: z.string(),
  requirements: z.array(z.string()),
  language: z.enum(["pt", "en", "other"]),
  eligibleFromBrazil: z.boolean(),
});

export type JobScore = z.infer<typeof ScoreSchema>;

const RUBRIC = `Você avalia vagas de emprego para um único candidato e devolve uma nota de aderência de 0 a 100.

Critérios, em ordem de peso:
1. Cargo: Full Stack TypeScript > Backend Node.js > AI Engineer / automação com LLM > Solutions/Implementation/Forward Deployed Engineer. Cargos fora de desenvolvimento (vendas, marketing, suporte puro) ficam abaixo de 20.
2. Senioridade: júnior, trainee ou pleno inicial encaixam. Sênior, staff, lead ou "5+ anos" obrigatórios derrubam a nota para no máximo 40.
3. Stack: quanto mais do que a vaga pede aparece no perfil do candidato, maior a nota. Requisito obrigatório que ele não tem pesa contra.
4. Local: ele mora no Brasil, só trabalha remoto e tem passaporte europeu. Vaga restrita a residentes dos EUA, Canadá, Reino Unido, Ásia etc. é inelegível: eligibleFromBrazil=false e nota no máximo 10. Vaga que aceita Brasil, LATAM, mundo todo ou União Europeia é elegível. Sem informação de local, considere elegível.
5. Idioma: vagas em inglês são bem-vindas.

Regras da resposta:
- reason: uma frase curta em português (até 200 caracteres), concreta, citando o que pesou. Sem elogios genéricos.
- requirements: até 8 requisitos principais da vaga, curtos (ex.: "Node.js", "3 anos com React", "inglês avançado").
- language: idioma em que a vaga foi escrita.
- Use só o que está no texto da vaga e no perfil. Não invente.`;

function loadCandidateProfile(): string {
  const fromEnv = process.env.CANDIDATE_PROFILE;
  if (fromEnv) return fromEnv;
  const path = "perfil/resumo-cv.md";
  if (existsSync(path)) return readFileSync(path, "utf8");
  throw new Error("Perfil do candidato ausente: defina CANDIDATE_PROFILE ou crie perfil/resumo-cv.md");
}

function describeJob(job: JobRow): string {
  return [
    `Título: ${job.title}`,
    `Empresa: ${job.company}`,
    `Local informado: ${job.location ?? "não informado"}`,
    `Fonte: ${job.source}`,
    "",
    job.description ? `Descrição:\n${job.description.slice(0, 6000)}` : "Descrição: não disponível (avalie pelo título).",
  ].join("\n");
}

export interface Scorer {
  score(job: JobRow): Promise<JobScore | undefined>;
}

export function createScorer(config: RadarConfig): Scorer {
  const client = new Anthropic();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: RUBRIC },
    { type: "text", text: `Perfil do candidato:\n${loadCandidateProfile()}`, cache_control: { type: "ephemeral" } },
  ];

  return {
    async score(job) {
      const response = await client.beta.messages.parse({
        model: config.scoringModel,
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: config.scoringEffort, format: betaZodOutputFormat(ScoreSchema) },
        system,
        messages: [{ role: "user", content: describeJob(job) }],
      });
      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return undefined;
      return response.parsed_output ?? undefined;
    },
  };
}
