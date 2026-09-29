import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Municipality of Pinamungajan | Official Website",
    template: "%s | Municipality of Pinamungajan",
  },
  description:
    "Municipality of Pinamungajan information portal for executive and legislative activities, public services, programs, ordinances, resolutions, and municipal updates.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
