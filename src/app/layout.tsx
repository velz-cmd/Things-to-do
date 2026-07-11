import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { Providers } from "@/components/providers";
import { wagmiConfig } from "@/lib/reown/config";
import { BRAND_LOGO_PATH } from "@/lib/brand/assets";
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
  title: "RESOLVE — Outcome network on Arc",
  description:
    "Mission control for outcome-backed payments. Bounties, distribution, and verified settlement on Arc USDC.",
  icons: {
    icon: [{ url: BRAND_LOGO_PATH, type: "image/png" }],
    apple: [{ url: BRAND_LOGO_PATH, type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialState = cookieToInitialState(
    wagmiConfig,
    (await headers()).get("cookie")
  );

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}
