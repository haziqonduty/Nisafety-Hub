import { Mail, Phone } from "@/app/_components/icons";

const DEVELOPER = {
  name: "Caryn Smart Tech",
  phoneDisplay: "017-7769 334",
  // Malaysian mobile in international form, so the tel: link works from anywhere.
  phoneHref: "tel:+60177769334",
  email: "carynstepforward@gmail.com",
};

/**
 * The developer's signature strip at the very bottom of the site, with
 * one-tap phone and email. Labels are passed in so the staff pages can
 * translate them (the admin area is English only).
 */
export function DeveloperCredit({
  label = "Crafted by",
  callLabel = "Call",
  emailLabel = "Email",
}: {
  label?: string;
  callLabel?: string;
  emailLabel?: string;
}) {
  const chip =
    "group/chip inline-flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink-muted transition-all hover:-translate-y-0.5 hover:border-accent hover:text-accent hover:shadow-[0_8px_20px_rgba(15,118,110,.12)]";
  const chipIcon = "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent transition-colors group-hover/chip:bg-accent group-hover/chip:text-white";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-soft p-4 sm:p-5">
      {/* Faint accent wash in the corner, like the rest of the site's cards. */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-soft/70 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-brand text-sm font-bold text-white shadow-[0_6px_14px_rgba(15,118,110,.25)]">
            C
          </span>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint">{label}</p>
            <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{DEVELOPER.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={DEVELOPER.phoneHref} className={chip} aria-label={`${callLabel} ${DEVELOPER.name}: ${DEVELOPER.phoneDisplay}`}>
            <span className={chipIcon}>
              <Phone className="h-3.5 w-3.5" />
            </span>
            <span className="tabular-nums">{DEVELOPER.phoneDisplay}</span>
          </a>
          <a href={`mailto:${DEVELOPER.email}`} className={chip} aria-label={`${emailLabel} ${DEVELOPER.name}: ${DEVELOPER.email}`}>
            <span className={chipIcon}>
              <Mail className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{DEVELOPER.email}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
