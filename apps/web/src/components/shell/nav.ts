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
  { href: "/banque", label: "Banque", icon: Landmark, shortcut: "G B", group: "" },
  { href: "/justificatifs", label: "Justificatifs", icon: FileText, shortcut: "G J", group: "" },
  { href: "/adherents", label: "Adhérents", icon: Users, shortcut: "G H", group: "" },
  { href: "/projets", label: "Projets", icon: FolderKanban, shortcut: "G P", group: "" },
  { href: "/rapports", label: "Rapports", icon: PieChart, shortcut: "G R", group: "" },
  // Outils pour les utilisateurs à l'aise avec la comptabilité : repliés par défaut.
  { href: "/operations", label: "Opérations", icon: ListOrdered, shortcut: "G O", group: "avance" },
  { href: "/comptabilite", label: "Comptabilité", icon: BookOpen, shortcut: "G C", group: "avance" },
  { href: "/assistant", label: "Assistant", icon: Bot, shortcut: "G I", group: "avance" },
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
