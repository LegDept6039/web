import Link from "next/link";
export default function NotFound() {
  return (
    <section className="container section text-center">
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1 className="text-4xl font-serif">Let’s get you back on track.</h1>
      <p className="body-copy my-6">
        The page or record you requested could not be found.
      </p>
      <Link href="/" className="button button-blue">
        Return to the homepage
      </Link>
    </section>
  );
}
