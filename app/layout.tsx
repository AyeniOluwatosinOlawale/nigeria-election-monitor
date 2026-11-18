import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nigerians Monitor Your Elections | NMYE 2027",
  description:
    "Your vote must count — real-time Nigeria election results 2027. Track presidential, senate, house of representatives, and gubernatorial results.",
  keywords: ["Nigeria elections", "2027 elections", "INEC", "election results", "NMYE"],
  openGraph: {
    title: "Nigerians Monitor Your Elections | NMYE 2027",
    description: "Your vote must count — real-time Nigeria election results 2027",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
