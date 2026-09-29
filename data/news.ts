import type { NewsArticle } from "@/types";
export const news: NewsArticle[] = [
  {
    slug: "community-first",
    title: "Bringing municipal services closer to every barangay",
    category: "Executive",
    date: "2026-09-28",
    image: "/images/news/community.svg",
    excerpt:
      "A community-centered approach to making public services more accessible.",
    content: [
      "This sample update demonstrates how executive news will appear on the municipal portal. It is not an announcement of a confirmed activity.",
      "The proposed feature brings service information together in one place, helping residents find the appropriate municipal office, understand requirements, and prepare for their visit.",
      "Verified schedules, participating offices, and contact details can be added by the municipality before publication.",
    ],
  },
  {
    slug: "regular-session",
    title: "In focus: the work of the Sangguniang Bayan",
    category: "Legislative",
    date: "2026-09-28",
    image: "/images/news/council.svg",
    excerpt:
      "Follow council sessions, proposed measures, and matters that shape our community.",
    content: [
      "This is a sample legislative news article for demonstration purposes.",
      "The legislative portal provides a place for session summaries, agendas, ordinances, and resolutions. Residents can browse records and learn more about the work of municipal committees.",
      "Official minutes, photographs, and approved documents will be supplied by the Sangguniang Bayan Secretariat.",
    ],
  },
  {
    slug: "coastal-community",
    title: "Working together for a cleaner, greener coastline",
    category: "Environment",
    date: "2026-09-24",
    image: "/images/news/coast.svg",
    excerpt:
      "Shared responsibility for the natural places that make our municipality home.",
    content: [
      "This sample environmental story is illustrative and does not describe a confirmed event.",
      "Community participation can support coastal protection through responsible waste management and environmental education.",
      "Verified project details and photos will be added when municipal content becomes available.",
    ],
  },
  {
    slug: "health-information",
    title: "A guide to community health services",
    category: "Health",
    date: "2026-09-22",
    image: "/images/news/community.svg",
    excerpt:
      "Find the right office for primary care information and community health assistance.",
    content: [
      "This sample guide introduces the health service directory.",
      "Contact the Municipal Health Office to confirm available services, schedules, and requirements before visiting. No medical appointments can be booked through this preview.",
    ],
  },
  {
    slug: "public-service-advisory",
    title: "Plan your visit to the municipal hall",
    category: "Announcements",
    date: "2026-09-20",
    image: "/images/news/council.svg",
    excerpt:
      "Use our service directory to find the office that can help with your concern.",
    content: [
      "This sample advisory helps demonstrate the announcement layout.",
      "Use the municipal service directory for general information. Office hours, documentary requirements, fees, and processing times must be confirmed with the responsible office.",
    ],
  },
];
