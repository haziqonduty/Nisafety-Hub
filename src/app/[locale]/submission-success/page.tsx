import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

function ShieldCheck() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8"><path d="M12 3.5 19 6v5.3c0 4.4-3 7.9-7 9.2-4-1.3-7-4.8-7-9.2V6l7-2.5Z" strokeLinejoin="round" /><path d="m8.7 11.8 2.1 2.1 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

export default async function SubmissionSuccessPage() {
  const t = await getTranslations("submissionSuccess");

  return <main className="grid min-h-screen place-items-center bg-canvas px-6 text-ink"><section className="w-full max-w-xl rounded-[1.75rem] border border-line bg-surface p-8 text-center shadow-[0_24px_55px_rgba(16,42,51,.08)] sm:p-12"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-accent"><ShieldCheck /></div><p className="mt-8 font-mono text-xs font-semibold tracking-[0.14em] text-accent">{t("eyebrow")}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em]">{t("title")}</h1><p className="mt-5 text-sm leading-7 text-ink-muted">{t("body")}</p><div className="mt-8 rounded-xl border border-line bg-surface-soft p-4 text-left"><p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted">{t("whatNextTitle")}</p><p className="mt-2 text-sm leading-6 text-ink-muted">{t("whatNextBody")}</p></div><div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link href="/" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover">{t("exploreDirectory")}</Link><Link href="/submit" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent-soft">{t("returnToSubmission")}</Link></div></section></main>;
}
