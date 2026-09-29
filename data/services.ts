import type { Service } from "@/types";
export const services: Service[] = [
  {
    id: "business-permits",
    name: "Business Permits",
    icon: "briefcase",
    office: "Business Permits and Licensing Office",
    description:
      "Information on starting, renewing, and registering your local business.",
    steps: [
      "Ask the licensing office for the current application checklist.",
      "Prepare the required business and identity documents.",
      "Submit your application and confirm the assessment and release schedule.",
    ],
  },
  {
    id: "civil-registry",
    name: "Civil Registry",
    icon: "file",
    office: "Municipal Civil Registrar",
    description:
      "Assistance with birth, marriage, death, and other civil registry records.",
    steps: [
      "Identify the record or registration service you need.",
      "Confirm identity and authorization requirements with the registrar.",
      "Submit your request at the Civil Registry office.",
    ],
  },
  {
    id: "health",
    name: "Health Services",
    icon: "heart",
    office: "Municipal Health Office",
    description: "Connect with primary care and community health programs.",
    steps: [
      "Contact the health office for current service availability.",
      "Ask about clinic schedules and any required records.",
      "Visit the appropriate health facility.",
    ],
  },
  {
    id: "social-welfare",
    name: "Social Welfare",
    icon: "users",
    office: "Municipal Social Welfare and Development Office",
    description: "Support and assistance for individuals and families in need.",
    steps: [
      "Discuss your concern with the social welfare office.",
      "Confirm eligibility and documentation for the relevant assistance.",
      "Follow the assessment and referral process.",
    ],
  },
  {
    id: "assessor",
    name: "Assessor’s Office",
    icon: "building",
    office: "Municipal Assessor",
    description: "Information on property assessment and tax declarations.",
    steps: [
      "Identify your property assessment concern.",
      "Confirm the relevant property documents.",
      "Submit the request to the assessor.",
    ],
  },
  {
    id: "treasurer",
    name: "Treasurer’s Office",
    icon: "wallet",
    office: "Municipal Treasurer",
    description: "Inquiries about local taxes, fees, and official payments.",
    steps: [
      "Confirm the applicable assessment and payment requirements.",
      "Pay only through authorized municipal channels.",
      "Keep your official receipt.",
    ],
  },
  {
    id: "engineering",
    name: "Engineering",
    icon: "building",
    office: "Municipal Engineering Office",
    description:
      "Guidance on building permits and municipal infrastructure concerns.",
    steps: [
      "Describe your construction or infrastructure inquiry.",
      "Request the current technical requirements.",
      "Submit plans and documentation to the responsible office.",
    ],
  },
  {
    id: "agriculture",
    name: "Agriculture",
    icon: "sprout",
    office: "Municipal Agriculture Office",
    description: "Information and support for farmers and local agriculture.",
    steps: [
      "Contact the agriculture office about available support.",
      "Confirm registration or eligibility requirements.",
      "Coordinate the next steps with the assigned staff.",
    ],
  },
  {
    id: "disaster-risk",
    name: "Disaster Risk Reduction",
    icon: "shield",
    office: "Municipal Disaster Risk Reduction and Management Office",
    description:
      "Preparedness information and disaster risk reduction programs.",
    steps: [
      "Ask the office for verified local preparedness information.",
      "Know your barangay evacuation routes and contacts.",
      "Follow official advisories during emergencies.",
    ],
  },
];
