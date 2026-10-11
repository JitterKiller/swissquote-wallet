import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { PressFeedback } from "@/components/providers/PressFeedback";
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
  title: { default: "SQure", template: "%s · SQure" },
  description: "SQure by Swissquote: your keys, Swiss security. A self-custody wallet prototype.",
};

/** The browser chrome takes the page's own ground, light or dark. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <PressFeedback />
        <WalletProvider>{children}</WalletProvider>
        <Toaster position="bottom-right" theme="system" richColors />
      </body>
    </html>
  );
}
