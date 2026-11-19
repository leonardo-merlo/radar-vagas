import { fetchText } from "../core/http.js";
import { SourceBlockedError, type Source, type SourceName } from "../core/types.js";

/**
 * Boards that refuse automated access or need a login or paid plan. We check once per run and
 * report the reason; we never try to get around a block or a CAPTCHA.
 */
function restricted(name: SourceName, probeUrl: string, reason: string): Source {
  return {
    name,
    async fetchJobs() {
      await fetchText(name, probeUrl, 15_000);
      throw new SourceBlockedError(name, reason);
    },
  };
}

export const indeed = restricted(
  "indeed",
  "https://br.indeed.com/jobs?q=desenvolvedor+junior&l=remoto",
  "respondeu, mas a listagem exige navegador real; sem coletor automático",
);

export const remoteco = restricted(
  "remoteco",
  "https://remote.co/remote-jobs/developer/",
  "respondeu, mas ainda sem coletor implementado",
);

export const flexjobs = restricted(
  "flexjobs",
  "https://www.flexjobs.com/remote-jobs/developer",
  "detalhes das vagas exigem assinatura paga",
);
