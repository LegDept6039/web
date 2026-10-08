import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
