import type { Metadata } from "next";
import "./globals.css";
import { FloatingAgent } from "@/components/FloatingAgent";

export const metadata: Metadata = {
  title: "Croman Ads Dashboard",
  description: "Meta Ads management dashboard — Santa Rosa Paraguay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full">
        {children}
        <FloatingAgent />
      </body>
    </html>
  );
}
