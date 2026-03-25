// Prompt: Root layout — imports Barlow Condensed (display) + Outfit (body) via
// next/font/google, wraps in ThemeProvider (next-themes, dark default),
// AuthProvider, renders Navbar + Toaster. All design tokens applied via CSS vars.
// Claude claude-4.6-opus-high-thinking

import type { Metadata } from "next";
import { Barlow_Condensed, Outfit } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display-var",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-body-var",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SportsDeck — Premier League Fan Hub",
  description:
    "Live scores, standings, forums, and community for Premier League fans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${barlowCondensed.variable} ${outfit.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <Navbar />
            <main className="min-h-[calc(100vh-4rem)]">{children}</main>
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "var(--sd-surface-raised)",
                  border: "1px solid var(--sd-border-subtle)",
                  color: "var(--foreground)",
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
