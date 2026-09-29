import {
  BriefcaseBusiness,
  FileText,
  HeartPulse,
  Users,
  Building2,
  Wallet,
  Sprout,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
const icons: Record<string, LucideIcon> = {
  briefcase: BriefcaseBusiness,
  file: FileText,
  heart: HeartPulse,
  users: Users,
  building: Building2,
  wallet: Wallet,
  sprout: Sprout,
  shield: ShieldCheck,
};
export function ServiceIcon({
  name,
  size = 25,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name] ?? Building2;
  return <Icon size={size} strokeWidth={1.6} />;
}
