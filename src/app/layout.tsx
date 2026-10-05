import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "LungJi - Card Shop",
  description: "LungJi Card Shop - Magic: The Gathering Card Kingdom Singles & Prices",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://cards.scryfall.io" crossOrigin="" />
        <link rel="dns-prefetch" href="https://cards.scryfall.io" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
