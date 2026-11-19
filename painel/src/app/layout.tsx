import type { Metadata } from "next";
import { IBM_Plex_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["500", "600", "700"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Radar de Vagas",
  description: "Vagas coletadas, triagem, candidaturas e contatos.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${jakarta.variable} ${plexMono.variable}`}>
      <body>
        <header className="border-b border-linha">
          <nav className="folha flex flex-wrap items-center gap-x-6 gap-y-2 py-4" style={{ paddingBottom: "1rem" }}>
            <Link href="/" className="font-display text-lg font-bold text-tinta no-underline">
              Radar de Vagas
            </Link>
            <Link href="/" className="text-tinta-media no-underline hover:text-tinta">
              Vagas
            </Link>
            <Link href="/metricas" className="text-tinta-media no-underline hover:text-tinta">
              Métricas
            </Link>
          </nav>
        </header>
        <main className="folha pt-6">{children}</main>
      </body>
    </html>
  );
}
