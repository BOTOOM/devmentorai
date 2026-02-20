import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
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

const DEFAULT_BASE_URL = "https://devmentorai.edwardiaz.dev";
const SITE_TITLE = "DevMentorAI — AI Mentor for Your Entire Browser";
const SITE_DESCRIPTION =
  "Context-aware AI assistance powered by GitHub Copilot. DevOps mentoring, writing help, and debugging — directly in your browser.";

async function getRequestBaseUrl() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    return DEFAULT_BASE_URL;
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${protocol}://${host}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getRequestBaseUrl();
  const socialImageUrl = `${baseUrl}/og-cover.jpg`;

  return {
    title: {
      default: SITE_TITLE,
      template: "%s | DevMentorAI",
    },
    description: SITE_DESCRIPTION,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: baseUrl,
      siteName: "DevMentorAI",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: socialImageUrl,
          width: 1200,
          height: 630,
          alt: "DevMentorAI — Context-Aware AI Browser Mentor",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [socialImageUrl],
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
}

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
