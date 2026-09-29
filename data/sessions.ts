import type { Session } from "@/types";
export const sessions: Session[] = [
  {
    id: "61st-regular",
    number: "61st",
    type: "Regular session",
    date: "2026-09-28",
    description:
      "Sample session of the 17th Sangguniang Bayan, covering committee reports and community matters.",
    agenda: [
      "Call to order and roll call",
      "Approval of previous minutes",
      "Committee reports",
      "Discussion of proposed measures",
      "Other matters and adjournment",
    ],
    image: "/images/news/council.svg",
  },
  {
    id: "60th-regular",
    number: "60th",
    type: "Regular session",
    date: "2026-09-21",
    description:
      "Sample deliberations on public services and local development priorities.",
    agenda: [
      "Review of communications",
      "Public service committee report",
      "Local development proposals",
    ],
    image: "/images/news/council.svg",
  },
  {
    id: "3rd-special",
    number: "3rd",
    type: "Special session",
    date: "2026-09-17",
    description: "Sample special session for time-sensitive municipal matters.",
    agenda: ["Call to order", "Consideration of special agenda", "Adjournment"],
    image: "/images/news/council.svg",
  },
  {
    id: "committee-caucus",
    number: "September",
    type: "Caucus meeting",
    date: "2026-09-14",
    description: "Sample preparatory discussion of committee priorities.",
    agenda: ["Committee coordination", "Scheduling of consultations"],
    image: "/images/news/council.svg",
  },
];
