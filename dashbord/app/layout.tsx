import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header, { SidebarNav } from "../conmponents/Header";
import Footer from "@/conmponents/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AvianVision",
  description: "AI-powered bird species identification — 525 species, powered by EfficientNetB0.",
};

// Root layout — wraps every page with the sticky header, left sidebar nav, and footer
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Applies the saved theme before the page shows, so it doesn't flash light first */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark");`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#f8f9f9] dark:bg-[#1b1d1f]">
        {/* Sticky top bar with brand name */}
        <Header />

        {/* Middle row: left sidebar nav + page content side by side */}
        <div className="flex flex-1 items-stretch">
          <SidebarNav />
          {children}
        </div>

        {/* Footer spans the full width below sidebar + content */}
        <Footer />
      </body>
    </html>
  );
}
