import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { COOKIE_TEMA, temaValido } from "@/lib/tema";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bancarella — conto per persona",
  description:
    "Registra le vendite della bancarella e tieni il conto di ogni persona che ti ha dato dei vestiti.",
  applicationName: "Bancarella",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Bancarella" },
};

const CHIARO = "#f6f5f2";
const SCURO = "#14140f";

export async function generateViewport(): Promise<Viewport> {
  const tema = temaValido((await cookies()).get(COOKIE_TEMA)?.value);
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor:
      tema === "chiaro"
        ? CHIARO
        : tema === "scuro"
          ? SCURO
          : [
              { media: "(prefers-color-scheme: light)", color: CHIARO },
              { media: "(prefers-color-scheme: dark)", color: SCURO },
            ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Il tema arriva dal cookie: l'HTML nasce già col colore giusto, senza lampi.
  const tema = temaValido((await cookies()).get(COOKIE_TEMA)?.value);

  return (
    <html lang="it" data-tema={tema}>
      <body>{children}</body>
    </html>
  );
}
