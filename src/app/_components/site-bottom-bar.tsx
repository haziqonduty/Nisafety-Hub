const DEVELOPER = {
  name: "Caryn Smart Tech",
  phoneDisplay: "017-7769 334",
  // Malaysian mobile in international form, so the tel: link works from anywhere.
  phoneHref: "tel:+60177769334",
  email: "carynstepforward@gmail.com",
};

/**
 * The site's bottom bar: copyright on the left, the developer credit on the
 * right, in one line of small muted text (the usual footer "legal bar"
 * pattern). Contact details are links that only take colour on hover, so
 * the credit stays quiet next to the client's brand. Labels are passed in
 * so the staff pages can translate them (the admin area is English only).
 */
export function SiteBottomBar({
  copyright = `© ${new Date().getFullYear()} Nisafety Consultancy`,
  creditLabel = "Crafted by",
}: {
  copyright?: string;
  creditLabel?: string;
}) {
  const link = "transition-colors hover:text-accent";
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-5 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
      <p>{copyright}</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          {creditLabel} <span className="font-medium text-ink-muted">{DEVELOPER.name}</span>
        </span>
        {/* On phones the contacts wrap onto their own line as one unit, so no separator is left dangling. */}
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <span className="flex items-center gap-x-2">
          <a href={DEVELOPER.phoneHref} className={`${link} tabular-nums`}>
            {DEVELOPER.phoneDisplay}
          </a>
          <span aria-hidden="true">·</span>
          <a href={`mailto:${DEVELOPER.email}`} className={link}>
            {DEVELOPER.email}
          </a>
        </span>
      </p>
    </div>
  );
}
