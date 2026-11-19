export function simplify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(a\)|\(o\)|\(as\)|\(os\)|\(e\)/g, "")
    .replace(/[^a-z0-9#+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TARGET_ROLE =
  /\b(developer|engineer|engineering|desenvolvedor|desenvolvedora|programador|programadora|full ?stack|back ?end|front ?end|software|automation|automacao|ai|ia|llm|machine learning|solutions|implementation|integration|integracao|trainee|node|react|typescript|javascript|python)\b/;

/** Cheap title filter so we don't score marketing or sales roles that keyword search drags in. */
export function isTargetRole(title: string): boolean {
  return TARGET_ROLE.test(simplify(title));
}

export function slugify(text: string): string {
  return simplify(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
