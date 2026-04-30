import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import HealthDot from "@/components/HealthDot";

export const metadata: Metadata = {
  title: "Job Finder — Rahul Taori",
  description: "Continuous job scraper, matcher, and approval queue for the Netherlands tech market",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="min-h-screen">
          <header className="border-b border-border">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="text-lg font-semibold tracking-tight">
                  <span className="text-accent">●</span> Job Finder
                </Link>
                <nav className="flex gap-4 text-sm text-muted">
                  <Link href="/" className="hover:text-text">Feed</Link>
                  <Link href="/sources" className="hover:text-text">Sources</Link>
                  <Link href="/knowledge" className="hover:text-text">Knowledge</Link>
                  <Link href="/observability" className="hover:text-text">Observability</Link>
                  <Link href="/duplicates" className="hover:text-text">Duplicates</Link>
                  <Link href="/settings" className="hover:text-text">Settings</Link>
                  <Link href="/env" className="hover:text-text">Env</Link>
                  <Link href="/?status=approved" className="hover:text-text">Approved</Link>
                  <Link href="/?status=interview" className="hover:text-text">Interviewing</Link>
                  <Link href="/?status=rejected" className="hover:text-text">Rejected</Link>
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <HealthDot />
                <div className="text-xs text-muted">localhost:8787</div>
              </div>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
