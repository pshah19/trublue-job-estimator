import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { getRole } from "@/lib/serverRole";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TruBlue Job Estimator",
  description: "AI-assisted, profit-protecting job estimates for home-service franchises.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f5bb5" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const role = await getRole();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <AppShell role={role}>{children}</AppShell>
      </body>
    </html>
  );
}
