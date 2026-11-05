import {
  BookOpen,
  Bot,
  FileText,
  FolderKanban,
  Home,
  Landmark,
  ListOrdered,
  PieChart,
  Settings,
  Users,
} from "lucide-react";

export const NAV = [
  { href: "", label: "Accueil", icon: Home, shortcut: "G A" },
  { href: "/banque", label: "Banque", icon: Landmark, shortcut: "G B" },
  { href: "/operations", label: "Opérations", icon: ListOrdered, shortcut: "G O" },
  { href: "/justificatifs", label: "Justificatifs", icon: FileText, shortcut: "G J" },
  { href: "/adherents", label: "Adhérents", icon: Users, shortcut: "G H" },
  { href: "/projets", label: "Projets", icon: FolderKanban, shortcut: "G P" },
  { href: "/comptabilite", label: "Comptabilité", icon: BookOpen, shortcut: "G C" },
  { href: "/rapports", label: "Rapports", icon: PieChart, shortcut: "G R" },
  { href: "/assistant", label: "Assistant", icon: Bot, shortcut: "G I" },
] as const;

export const SETTINGS_NAV = { href: "/parametres", label: "Paramètres", icon: Settings };

export interface ShellProps {
  org: { name: string; slug: string; plan: string };
  orgs: { name: string; slug: string }[];
  user: { email: string; name: string | null; avatar: string | null };
  role: string;
  pendingCount: number;
  isPlatformAdmin: boolean;
  aiEnabled: boolean;
}
