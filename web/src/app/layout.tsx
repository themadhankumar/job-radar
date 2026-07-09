import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Martian_Mono } from "next/font/google";
import "./globals.css";

// Instrument face — data numerals only (match %, pay, YoE, sponsor counts).
const martianMono = Martian_Mono({ subsets: ["latin"], variable: "--font-martian", display: "swap" });

export const metadata: Metadata = {
  title: "Job Radar",
  description: "Your personal job-search command center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if(localStorage.theme==='dark'||(!('theme' in localStorage)&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')`,
          }}
        />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${martianMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
