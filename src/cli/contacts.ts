import { readFileSync } from "node:fs";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { contactsSearchedToday, createDb, jobById, jobsNeedingContacts, saveContacts } from "../db/client.js";

// Usage:
//   npm run contatos -- pendentes                 companies of approved jobs still without a contact search
//   npm run contatos -- salvar <job-id> <file>    saves the contacts found (JSON array) and marks the company as searched

const ContactSchema = z.object({
  name: z.string().min(2),
  title: z.string().nullable().default(null),
  kind: z.enum(["recruiter", "tech_recruiter", "talent_acquisition", "hiring_manager", "team_member", "other"]),
  linkedin_url: z
    .string()
    .url()
    .refine((url) => /^https:\/\/([a-z]+\.)?linkedin\.com\/in\//.test(url), "precisa ser um perfil linkedin.com/in/")
    .transform((url) => url.replace(/\?.*$/, "")),
  why: z.string().nullable().default(null),
  message_draft: z.string().max(300).nullable().default(null),
});

const config = loadConfig();
const db = createDb();
const [command, ...rest] = process.argv.slice(2);

if (command === "pendentes") {
  const doneToday = contactsSearchedToday(db);
  const budget = Math.max(0, config.contactSearchesPerDay - doneToday);
  const jobs = budget > 0 ? jobsNeedingContacts(db, budget) : [];
  console.log(
    JSON.stringify(
      {
        searchedToday: doneToday,
        dailyLimit: config.contactSearchesPerDay,
        contactsPerCompany: config.contactsPerCompany,
        companies: jobs.map((job) => ({
          job_id: job.id,
          company: job.company,
          title: job.title,
          url: job.url,
          language: job.language,
          requirements: job.requirements,
        })),
      },
      null,
      2,
    ),
  );
} else if (command === "salvar") {
  const [jobId, file] = rest;
  if (!jobId || !file) throw new Error("Uso: npm run contatos -- salvar <job-id> <arquivo.json>");
  const contacts = z.array(ContactSchema).max(config.contactsPerCompany * 2).parse(JSON.parse(readFileSync(file, "utf8")));
  const job = jobById(db, jobId);
  const saved = saveContacts(db, job, contacts);
  console.log(`${job.company}: ${saved} contatos salvos; empresa marcada como pesquisada.`);
} else {
  throw new Error('Comando desconhecido. Use "pendentes" ou "salvar".');
}
