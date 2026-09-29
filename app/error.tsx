"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="container section text-center">
      <h1 className="text-3xl font-serif">We couldn’t load this page.</h1>
      <p className="body-copy my-6">Please try again.</p>
      <button className="button button-blue" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
