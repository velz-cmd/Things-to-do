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
  // Restoring wagmi state is an optimisation, and it must never be able to
  // break the page. This runs in the root layout, so a throw here returns 500
  // for EVERY route in the app - and it throws on a wagmi.store cookie the
  // app itself writes once a wallet is connected, which left anyone who had
  // connected a wallet unable to load any page until they cleared cookies.
  // API routes were unaffected because no layout renders for them.
  let initialState: ReturnType<typeof cookieToInitialState>;
  try {
    initialState = cookieToInitialState(
      wagmiConfig,
      (await headers()).get("cookie")
    );
  } catch (error) {
    console.error("[layout] ignoring unreadable wagmi cookie", error);
    initialState = undefined;
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}
