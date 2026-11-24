import Link from "next/link";
import {
  Eye,
  ExternalLink,
  FileText,
  Pencil,
  Settings2,
  Trash2,
} from "lucide-react";

const actions = {
  edit: { icon: Pencil, label: "Edit" },
  view: { icon: Eye, label: "View" },
  public: { icon: ExternalLink, label: "Public page" },
  file: { icon: FileText, label: "Open file" },
  settings: { icon: Settings2, label: "Settings" },
  delete: { icon: Trash2, label: "Delete" },
} as const;

export function AdminActionIcon({ action }: { action: keyof typeof actions }) {
  const Icon = actions[action].icon;
  return <Icon size={18} aria-hidden="true" />;
}

/** Compact row actions retain a visible hover title and an accessible name. */
export function AdminActionLink({
  href,
  action = "edit",
  label = actions[action].label,
  target,
  rel,
}: {
  href: string;
  action?: Exclude<keyof typeof actions, "delete">;
  label?: string;
  target?: string;
  rel?: string;
}) {
  return (
    <Link
      className="admin-row-action"
      href={href}
      aria-label={label}
      title={label}
      target={target}
      rel={rel}
    >
      <AdminActionIcon action={action} />
    </Link>
  );
}
