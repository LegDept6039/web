import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession, getSessionRecords } from "@/lib/api";
import { SessionDetail } from "@/components/legislative/SessionDetail";
import { formatDate } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await getSession((await params).id);
  return {
    title:
      session?.name ||
      (session ? `${session.number} ${session.type}` : "Session not found"),
    description: session
      ? `Ordinances, resolutions, agenda and minutes for the council session on ${formatDate(session.date)}.`
      : undefined,
  };
}

export default async function Page({ params }: Props) {
  const session = await getSession((await params).id);
  if (!session) notFound();
  return (
    <SessionDetail
      session={session}
      records={await getSessionRecords(session)}
    />
  );
}
