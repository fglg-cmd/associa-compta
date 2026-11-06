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
  { href: "", label: "Accueil", icon: Home, shortcut: "G A", group: "" },
  { href: "/banque", label: "Banque", icon: Landmark, shortcut: "G B", group: "Gestion" },
  { href: "/operations", label: "Opérations", icon: ListOrdered, shortcut: "G O", group: "Gestion" },
  { href: "/justificatifs", label: "Justificatifs", icon: FileText, shortcut: "G J", group: "Gestion" },
  { href: "/adherents", label: "Adhérents", icon: Users, shortcut: "G H", group: "Vie associative" },
  { href: "/projets", label: "Projets", icon: FolderKanban, shortcut: "G P", group: "Vie associative" },
  { href: "/comptabilite", label: "Comptabilité", icon: BookOpen, shortcut: "G C", group: "Comptes" },
  { href: "/rapports", label: "Rapports", icon: PieChart, shortcut: "G R", group: "Comptes" },
  { href: "/assistant", label: "Assistant", icon: Bot, shortcut: "G I", group: "Comptes" },
] as const;

export const SETTINGS_NAV = { href: "/parametres", label: "Paramètres", icon: Settings, group: "" };

export interface ShellProps {
  org: { name: string; slug: string; plan: string };
  orgs: { name: string; slug: string }[];
  user: { email: string; name: string | null; avatar: string | null };
  role: string;
  pendingCount: number;
  isPlatformAdmin: boolean;
  aiEnabled: boolean;
  beta: boolean;
}
