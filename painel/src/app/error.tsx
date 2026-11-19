"use client";
// Client component: Next.js error boundaries must run in the browser to offer a retry.

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="py-6">
      <h1 className="mb-2 text-2xl">Não consegui ler o banco</h1>
      <p className="mb-4 text-tinta-media">
        Se é a primeira vez, rode <span className="cod">npm run radar</span> na pasta do projeto para criar <span className="cod">data/radar.db</span>.
        Detalhe: {error.message}
      </p>
      <button className="botao" type="button" onClick={reset}>
        Tentar de novo
      </button>
    </section>
  );
}
