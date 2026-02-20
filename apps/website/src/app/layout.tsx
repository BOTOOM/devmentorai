import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DevMentorAI — AI Mentor for Your Entire Browser",
    template: "%s | DevMentorAI",
  },
  description:
    "Context-aware AI assistance powered by GitHub Copilot. DevOps mentoring, writing help, and debugging — directly in your browser.",
  metadataBase: new URL("https://devmentorai.edwardiaz.dev"),
  openGraph: {
    title: "DevMentorAI — AI Mentor for Your Entire Browser",
    description:
      "Context-aware AI assistance powered by GitHub Copilot. DevOps mentoring, writing help, and debugging — directly in your browser.",
    url: "https://devmentorai.edwardiaz.dev",
    siteName: "DevMentorAI",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "DevMentorAI — Context-Aware AI Browser Mentor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DevMentorAI — AI Mentor for Your Entire Browser",
    description:
      "Context-aware AI assistance powered by GitHub Copilot. DevOps mentoring, writing help, and debugging — directly in your browser.",
    images: ["/twitter-image"],
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "32x32", type: "image/png" },
      { url: "/icon", sizes: "192x192", type: "image/png" },
    ],
    shortcut: ["/icon"],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
