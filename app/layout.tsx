import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Windows Vista — Aero Desktop",
  description:
    "A working Windows Vista browser desktop with Aero glass, built-in applications, and a persistent local file system.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
