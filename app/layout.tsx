import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INNOSpark Dashboard",
  description: "Live participant dashboard for the INNOSpark Pitch Competition",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
