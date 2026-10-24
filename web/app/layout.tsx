import type { Metadata } from "next";
import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";

export const metadata: Metadata = {
  title: "Spawnpad — every mint ends in Spw",
  description:
    "Next-generation Solana token launchpad powered by the Pump.fun V2 bonding curve engine with an integrated Spw vanity mint generator.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-obsidian min-h-screen">
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
