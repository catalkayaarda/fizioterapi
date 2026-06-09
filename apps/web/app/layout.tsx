import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FizioTerapi",
  description: "Hasta ve fizyoterapistleri buluşturan modern fizyoterapi marketplace uygulaması"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
