import { describe, expect, it } from "vitest";
import { parseLinkedInCards, parseLinkedInDetail } from "./linkedin.js";
import { parseProgramathorPage } from "./programathor.js";
import { parseVagasPage } from "./vagas.js";

describe("LinkedIn guest pages", () => {
  const card = `<li><div data-entity-urn="urn:li:jobPosting:4487013532">
    <h3 class="base-search-card__title">  Desenvolvedor Júnior  </h3>
    <h4 class="base-search-card__subtitle"><a class="hidden-nested-link" href="#"> BairesDev </a></h4>
    <span class="job-search-card__location"> Brazil </span>
    <time class="job-search-card__listdate" datetime="2026-11-18">hoje</time></div></li>`;

  it("reads id, title and company from a search card", () => {
    const [job] = parseLinkedInCards(card, "pt");
    expect(job).toMatchObject({ externalId: "4487013532", title: "Desenvolvedor Júnior", company: "BairesDev" });
  });

  it("flags offsite applications as external", () => {
    expect(parseLinkedInDetail('<span class="apply-button__offsite-apply-icon-svg"></span>').applyType).toBe("external");
  });
});

describe("Vagas.com listing", () => {
  it("reads title, company and city", () => {
    const html = `<li class="vaga odd "><a class="link-detalhes-vaga" data-id-vaga="2841827" title="Desenvolvedor de Software Jr" href="/vagas/v2841827/desenvolvedor-de-software-jr">x</a>
      <span class="emprVaga"> HStern </span><div class="detalhes"><p>Descrição</p></div>
      <div class="vaga-local"> <i class="bx bx-map"></i> Rio de Janeiro / RJ <div class="tooltip-place"></div></div>
      <span class="data-publicacao"><i></i>04/11/2026</span></li>`;
    const [job] = parseVagasPage(html);
    expect(job).toMatchObject({ externalId: "2841827", company: "HStern", location: "Rio de Janeiro / RJ", postedAt: "2026-11-04" });
  });
});

describe("Programathor listing", () => {
  it("reads company and location from the icon spans", () => {
    const html = `<div class="cell-list "><a href="/jobs/33685-dev"><h3 class="text-24">Dev Node</h3>
      <span><i class='fa fa-briefcase'></i>LOLDESIGN</span><span><i class='fas fa-map-marker-alt'></i>Remoto</span></a></div>`;
    const [job] = parseProgramathorPage(html);
    expect(job).toMatchObject({ externalId: "33685", title: "Dev Node", company: "LOLDESIGN", location: "Remoto" });
  });
});
