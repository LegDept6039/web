import type { Collection, Collections } from "@/lib/content/schema";
import type { ContentFilters } from "@/lib/content/supabase";
import type { LegislativeDocument, MunicipalDocument, Session } from "@/types";

type SessionReader = <K extends Collection>(
  collection: K,
  filters?: ContentFilters,
  limit?: number,
) => Promise<Collections[K][]>;

export interface SessionRecords {
  ordinances: LegislativeDocument[];
  resolutions: LegislativeDocument[];
  agendas: MunicipalDocument[];
  minutes: MunicipalDocument[];
}

/** A session ID remains the authority when two sessions share a date. */
export async function loadSession(id: string, read: SessionReader) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(id)) return undefined;
  const sessions = await read("sessions", { id }, 1);
  return sessions.find(
    (session) => session.id === id && session.contentScope !== "executive",
  );
}

export async function loadSessionRecords(
  session: Session,
  read: SessionReader,
): Promise<SessionRecords> {
  if (session.contentScope === "executive")
    return { ordinances: [], resolutions: [], agendas: [], minutes: [] };

  const filters: ContentFilters = {
    session_id: session.id,
    content_scope: "legislative",
    // An unassigned historical session must not acquire another term's records.
    term_id: session.termId ?? null,
    ...(session.officeId ? { office_id: session.officeId } : {}),
  };
  const passedFilters = {
    ...filters,
    date_approved: session.date,
  };
  const [ordinances, resolutions, agendas, minutes] = await Promise.all([
    read("ordinances", passedFilters),
    read("resolutions", passedFilters),
    read("documents", { ...filters, document_type: "agenda" }),
    read("documents", { ...filters, document_type: "minutes" }),
  ]);
  const belongs = (document: LegislativeDocument | MunicipalDocument) =>
    document.sessionId === session.id &&
    document.contentScope === "legislative" &&
    document.termId === session.termId &&
    (!session.officeId || document.officeId === session.officeId);
  const passed = (document: LegislativeDocument) =>
    belongs(document) &&
    document.dateApproved === session.date &&
    ["approved", "adopted"].includes(document.status.trim().toLowerCase());
  return {
    ordinances: ordinances.filter(passed),
    resolutions: resolutions.filter(passed),
    // Agendas can be prepared before a session; minutes can be published later.
    agendas: agendas.filter(
      (document) => belongs(document) && document.documentType === "agenda",
    ),
    minutes: minutes.filter(
      (document) => belongs(document) && document.documentType === "minutes",
    ),
  };
}
