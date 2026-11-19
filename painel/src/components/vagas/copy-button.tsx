"use client";
// Client component: the Clipboard API only exists in the browser.

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button className="botao" type="button" onClick={copy}>
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
