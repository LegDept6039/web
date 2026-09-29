export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  href?: string;
}
export const documentCategories: DocumentCategory[] = [
  {
    id: "full-disclosure",
    name: "Full Disclosure",
    description: "Financial reports and disclosures for public accountability.",
  },
  {
    id: "ordinances",
    name: "Ordinances",
    description: "Browse sample local legislative measures.",
    href: "/legislative/ordinances",
  },
  {
    id: "resolutions",
    name: "Resolutions",
    description: "Browse sample resolutions of the Sangguniang Bayan.",
    href: "/legislative/resolutions",
  },
  {
    id: "municipal-documents",
    name: "Municipal documents",
    description: "Municipal plans, reports, and other public information.",
  },
  {
    id: "budget",
    name: "Budget documents",
    description: "Annual budgets and financial planning documents.",
  },
  {
    id: "procurement",
    name: "Procurement documents",
    description: "Procurement plans, invitations, and award notices.",
  },
  {
    id: "public-notices",
    name: "Public notices",
    description: "Public advisories and notices issued by the municipality.",
  },
];
