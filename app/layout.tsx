import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "安芸灘しおり Digital Guide";
  const description = "旅のしおりは、しおりちゃんにおまかせ♪ 安芸灘とびしま海道の公式デジタル観光ガイド。";
  return {
    title,
    description,
    icons: {
      icon: "/shiori-icon.png",
      shortcut: "/shiori-icon.png",
      apple: "/shiori-icon.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ja_JP",
      images: [{ url: `${origin}/og.png`, width: 1678, height: 941, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
