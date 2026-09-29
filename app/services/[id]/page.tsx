export const dynamicParams = false;
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getServices } from "@/lib/api";
import { PageHero, PreviewNote } from "@/components/shared/ui";
export async function generateStaticParams() {
  return (await getServices()).map((s) => ({ id: s.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = (await getServices()).find((s) => s.id === id);
  return { title: s?.name ?? "Service not found", description: s?.description };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = (await getServices()).find((s) => s.id === id);
  if (!s) notFound();
  return (
    <>
      <PageHero
        title={s.name}
        description={s.description}
        eyebrow="MUNICIPAL SERVICES"
      />
      <section className="container section">
        <div className="article">
          <PreviewNote>
            General sample guidance. Confirm current requirements, fees,
            processing times, and availability directly with the office.
          </PreviewNote>
          <span className="eyebrow">RESPONSIBLE OFFICE</span>
          <h2>{s.office}</h2>
          <h3 className="mt-8">Getting started</h3>
          <ol className="steps">
            {s.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="info-card mt-8">
            <h3>Before your visit</h3>
            <p>
              Municipal Hall, Pinamungajan, Cebu, Philippines. Verified office
              hours and contact details are awaiting publication.
            </p>
            <Link href="/contact" className="text-link">
              Contact information
              <ArrowRight size={16} />
            </Link>
          </div>
          <Link href="/services" className="text-link mt-8">
            Back to all services
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
