import type { Source } from "../core/types.js";
import { geekhunter } from "./geekhunter.js";
import { gupy } from "./gupy.js";
import { himalayas } from "./himalayas.js";
import { linkedin } from "./linkedin.js";
import { programathor } from "./programathor.js";
import { remoteok } from "./remoteok.js";
import { flexjobs, indeed, remoteco } from "./restricted.js";
import { trampos } from "./trampos.js";
import { vagas } from "./vagas.js";
import { wellfound } from "./wellfound.js";
import { weworkremotely } from "./weworkremotely.js";

export const SOURCES: Source[] = [
  linkedin,
  gupy,
  indeed,
  programathor,
  trampos,
  vagas,
  geekhunter,
  wellfound,
  weworkremotely,
  remoteok,
  remoteco,
  himalayas,
  flexjobs,
];
