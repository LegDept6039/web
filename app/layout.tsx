import type { Metadata } from "next";
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
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
