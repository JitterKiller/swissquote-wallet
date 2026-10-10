import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { WalletProvider } from "@/components/providers/WalletProvider";

import "./globals.css";

const sans = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Swissquote Wallet", template: "%s · Swissquote Wallet" },
  description: "Self-custody wallet prototype: passkeys, gasless transfers, guardian recovery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <WalletProvider>{children}</WalletProvider>
        <Toaster position="bottom-right" theme="system" richColors />
      </body>
    </html>
  );
}
