import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { WalletProvider } from "@/components/providers/WalletProvider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <WalletProvider>{children}</WalletProvider>
        <Toaster position="top-center" theme="system" richColors />
      </body>
    </html>
  );
}
