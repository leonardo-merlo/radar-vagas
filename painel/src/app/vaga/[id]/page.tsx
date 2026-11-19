import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setContactStatus } from "@/app/actions";
import { CopyButton } from "@/components/vagas/copy-button";
import { TriageButtons } from "@/components/vagas/triage-buttons";
import type { ContactKind, ContactStatus } from "@/lib/database.types";
import { postedDate, SCOPE_LABEL, SENIORITY_LABEL, STATUS_LABEL } from "@/lib/filters";
import { getJob } from "@/lib/queries";

const KIND_LABEL: Record<ContactKind, string> = {
  tech_recruiter: "Tech recruiter",
  recruiter: "Recrutador(a)",
  talent_acquisition: "Talent acquisition",
  hiring_manager: "Gestor(a) do time",
  team_member: "Pessoa do time",
  other: "Outro",
};

const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  found: "Encontrado",
  invited: "Convite enviado",
  messaged: "Mensagem enviada",
  replied: "Respondeu",
  ignored: "Não vou chamar",
};

const APPLY_LABEL = { easy_apply: "Easy Apply", form: "Formulário", email: "E-mail", external: "Site externo", unknown: "Não identificado" };

export default function JobPage({ params }: PageProps<"/vaga/[id]">) {
  return (
    <Suspense fallback={<p className="text-tinta-fraca">Carregando vaga…</p>}>
      <Job params={params} />
    </Suspense>
  );
}

async function Job({ params }: { params: PageProps<"/vaga/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await getJob(id);
  if (!result) notFound();
  const { job, contacts } = result;
  const posted = postedDate(job.posted_at, job.first_seen_at);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/">Voltar para vagas</Link>
      </p>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">{job.title}</h1>
          <p className="text-tinta-media">
            {job.company}
            {job.location ? ` · ${job.location}` : ""} · {SCOPE_LABEL[job.remote_scope]} · {SENIORITY_LABEL[job.seniority]}
          </p>
          <p className="text-sm text-tinta-media">
            {posted.seenOnly ? "Vista pelo radar em " : "Publicada em "}
            <span className="cod">{posted.date}</span> ({posted.relative})
          </p>
        </div>
        <TriageButtons id={job.id} status={job.status} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <h3>Nota {job.score ?? "–"}</h3>
          <p className="text-sm">{job.score_reason ?? "Ainda sem nota."}</p>
        </div>
        <div className="card">
          <h3>{STATUS_LABEL[job.status]}</h3>
          <p className="text-sm">
            {job.status_reason ?? "Sem observação."}
            {job.applied_at ? ` Candidatura em ${new Date(job.applied_at).toLocaleDateString("pt-BR")}.` : ""}
          </p>
        </div>
        <div className="card">
          <h3>{APPLY_LABEL[job.apply_type]}</h3>
          <p className="text-sm">
            <a href={job.apply_url ?? job.url} target="_blank" rel="noreferrer">
              Abrir vaga
            </a>{" "}
            · vista em <span className="cod">{job.sources.join(", ")}</span>
          </p>
        </div>
      </div>

      {job.requirements?.length ? (
        <section className="mb-6">
          <h2 className="mb-2 text-lg">Requisitos</h2>
          <div className="flex flex-wrap gap-2">
            {job.requirements.map((requirement) => (
              <span key={requirement} className="cod">
                {requirement}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6" data-testid="contatos">
        <h2 className="mb-2 text-lg">Contatos na empresa</h2>
        {contacts.length === 0 ? (
          <p className="text-tinta-media">
            {job.contacts_searched_at
              ? "A busca não achou ninguém relevante."
              : job.status === "approved"
                ? 'Ainda não buscados. Rode "busca contatos" no Claude.'
                : "Aprove a vaga para entrar na busca de contatos."}
          </p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Rascunho da nota</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <th scope="row">
                      <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="font-semibold">
                        {contact.name}
                      </a>
                      <div className="text-tinta-media">{contact.title}</div>
                      <div className="text-sm text-tinta-fraca">
                        {KIND_LABEL[contact.kind]}
                        {contact.why ? ` · ${contact.why}` : ""}
                      </div>
                    </th>
                    <td>
                      {contact.message_draft ? (
                        <div className="flex flex-col items-start gap-2">
                          <p className="msg">{contact.message_draft}</p>
                          <CopyButton text={contact.message_draft} />
                        </div>
                      ) : (
                        <span className="text-tinta-fraca">sem rascunho</span>
                      )}
                    </td>
                    <td>
                      <form action={setContactStatus} className="flex flex-col items-center gap-2">
                        <input type="hidden" name="id" value={contact.id} />
                        <input type="hidden" name="jobId" value={job.id} />
                        <select className="campo" name="status" defaultValue={contact.status}>
                          {Object.entries(CONTACT_STATUS_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button className="botao" type="submit">
                          Salvar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {job.description ? (
        <section>
          <h2 className="mb-2 text-lg">Descrição</h2>
          <p className="whitespace-pre-line text-tinta-media">{job.description}</p>
        </section>
      ) : null}
    </>
  );
}
