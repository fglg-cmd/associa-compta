import { cn } from "@/lib/utils";

/** Réseaux sociaux officiels d'ASSOCIA COMPTA. */
export const SOCIAL_LINKS = [
  { name: "Instagram", handle: "@associa.compta", href: "https://www.instagram.com/associa.compta/" },
  { name: "TikTok", handle: "@associacompta", href: "https://www.tiktok.com/@associacompta" },
] as const;

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

const ICONS = { Instagram: InstagramIcon, TikTok: TikTokIcon };

/** Boutons ronds vers les réseaux sociaux (ouverture dans un nouvel onglet). */
export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul className={cn("flex items-center gap-2", className)}>
      {SOCIAL_LINKS.map((s) => {
        const Icon = ICONS[s.name];
        return (
          <li key={s.name}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer me"
              aria-label={`${s.name} ${s.handle} (nouvel onglet)`}
              title={`${s.name} · ${s.handle}`}
              className="grid size-9 place-items-center rounded-full border border-border bg-surface text-muted shadow-xs transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Icon className="size-4" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
