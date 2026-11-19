import { Suspense } from "react";
import { signIn } from "../actions";

const ERRORS: Record<string, string> = {
  email: "E-mail inválido.",
  envio: "Não foi possível enviar o link. Confira se este e-mail tem acesso.",
  link: "O link expirou ou já foi usado. Peça outro.",
  "sem-acesso": "Este e-mail entrou, mas não está liberado no painel (tabela dashboard_users).",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <section className="max-w-sm py-10">
      <h1 className="mb-4 text-2xl">Entrar</h1>
      <Suspense>
        <LoginMessage searchParams={searchParams} />
      </Suspense>
      <form action={signIn} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-tinta-media">
          E-mail
          <input className="campo" type="email" name="email" required autoComplete="email" />
        </label>
        <button className="botao botao-principal" type="submit">
          Enviar link de acesso
        </button>
      </form>
    </section>
  );
}

async function LoginMessage({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const error = typeof params.erro === "string" ? ERRORS[params.erro] : undefined;
  if (params.enviado) return <p className="msg mb-4">Link enviado. Abra o e-mail neste navegador.</p>;
  if (error) return <p className="mb-4 text-erro">{error}</p>;
  return null;
}
