import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ifeandjay.vercel.app"),
  title: "Ifedayo & Joyce · Traditional Wedding",
  description:
    "Celebrate the traditional wedding of Adedeji Ifedayo Micheal and Joyce Passion Akora in November 2026.",
  keywords: [
    "Ifedayo and Joyce wedding",
    "Nigerian traditional wedding",
    "November 2026 wedding",
  ],
  openGraph: {
    title: "Ifedayo & Joyce · Traditional Wedding",
    description: "Connection established. Join us in November 2026.",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Ifedayo and Joyce traditional wedding" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ifedayo & Joyce · Traditional Wedding",
    description: "Connection established. Join us in November 2026.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
