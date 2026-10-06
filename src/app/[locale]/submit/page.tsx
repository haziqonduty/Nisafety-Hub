"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type ChangeEvent, type FormEvent, type SVGProps } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Link, useRouter } from "@/i18n/routing";
import { compressPdf } from "@/lib/compress-pdf";
import { CATEGORY_GROUPS } from "@/lib/format";

// Matches the server's own MAX_FILE_SIZE in src/app/api/submissions/route.ts —
// both driven by Vercel's hard 4.5MB request-body limit, confirmed directly
// (a 6MB upload returns 413 FUNCTION_PAYLOAD_TOO_LARGE before our code runs).
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type IconProps = SVGProps<SVGSVGElement>;

function Upload(props: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function Arrow(props: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}><path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function File(props: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}><path d="M14 3H6.8A1.8 1.8 0 0 0 5 4.8v14.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V7l-5-4Z" strokeLinejoin="round" /><path d="M14 3v4h5" strokeLinejoin="round" /></svg>; }

const fieldClass = "mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

const KNOWN_ERROR_CODES = [
  "MISSING_FIELDS",
  "INVALID_EMAIL",
  "INVALID_CATEGORY",
  "INVALID_FILE_TYPE",
  "FILE_SIZE",
  "CLIENT_SAVE_ERROR",
  "UPLOAD_ERROR",
  "DOCUMENT_SAVE_ERROR",
  "RATE_LIMITED",
  "FILE_TOO_LARGE_AFTER_COMPRESSION",
  "FILE_TYPE_CANNOT_COMPRESS",
] as const;
type ErrorCode = (typeof KNOWN_ERROR_CODES)[number];

function errorCodeFrom(value: string | undefined): ErrorCode | "GENERIC" {
  return KNOWN_ERROR_CODES.includes(value as ErrorCode) ? (value as ErrorCode) : "GENERIC";
}

type SubmissionValues = {
  clientName: string;
  companyName: string;
  telephone: string;
  email: string;
  submitterName: string;
  category: string;
};

export default function SubmitPage() {
  const t = useTranslations("submit");
  const tErrors = useTranslations("submissionErrors");
  const tGroups = useTranslations("categories.groups");
  const tCategories = useTranslations("categories.items");

  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<SubmissionValues>({ clientName: "", companyName: "", telephone: "", email: "", submitterName: "", category: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachDocument, setAttachDocument] = useState(true);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function nextStep() {
    if (formRef.current?.reportValidity()) {
      setError("");
      setStep(2);
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setCompressionNotice("");

    if (!file || file.size <= MAX_FILE_SIZE) {
      setSelectedFile(file);
      return;
    }

    if (file.type !== "application/pdf") {
      setSelectedFile(null);
      event.target.value = "";
      setError(tErrors("FILE_TYPE_CANNOT_COMPRESS"));
      return;
    }

    setIsCompressing(true);
    setSelectedFile(null);
    try {
      const result = await compressPdf(file, MAX_FILE_SIZE);
      if (!result.ok) {
        event.target.value = "";
        setError(tErrors("FILE_TOO_LARGE_AFTER_COMPRESSION"));
        return;
      }
      setSelectedFile(result.file);
      setCompressionNotice(t("compressedNotice", { originalSize: formatMegabytes(result.originalSize), newSize: formatMegabytes(result.compressedSize) }));
    } finally {
      setIsCompressing(false);
    }
  }

  function updateField(field: keyof SubmissionValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (attachDocument && !selectedFile) {
      setError(tErrors("noFile"));
      return;
    }

    setError("");
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("website", honeypot);
    formData.append("clientName", values.clientName);
    formData.append("companyName", values.companyName);
    formData.append("telephone", values.telephone);
    formData.append("email", values.email);
    formData.append("submitterName", values.submitterName);
    if (attachDocument && selectedFile) {
      formData.append("category", values.category);
      formData.append("file", selectedFile);
    }

    try {
      const response = await fetch("/api/submissions", { method: "POST", body: formData });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(tErrors(errorCodeFrom(result.error)));
        return;
      }
      router.push("/submission-success");
    } catch {
      setError(tErrors("NETWORK_ERROR"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="min-h-screen bg-canvas text-ink">
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
      <BrandLogo />
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
        <Link href="/" className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover">{t("backToDirectory")}</Link>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 lg:px-8 lg:pt-16">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs font-semibold tracking-[0.14em] text-accent">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{t("title")}</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-ink-muted">{t("subtitle")}</p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <div className="flex items-center gap-3" aria-label={`Step ${step} of 2`}>
          {[1, 2].map((number) => <div key={number} className="flex flex-1 items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${step >= number ? "bg-brand text-white" : "border border-line bg-surface text-ink-faint"}`}>{number}</span><span className={`hidden text-xs font-semibold sm:block ${step >= number ? "text-ink" : "text-ink-faint"}`}>{number === 1 ? t("stepClientDetails") : t("stepDocumentUpload")}</span>{number === 1 && <span className="h-px flex-1 bg-line" />}</div>)}
        </div>

        <form ref={formRef} onSubmit={submit} className="mt-7 rounded-[1.5rem] border border-line bg-surface p-6 shadow-[0_20px_50px_rgba(16,42,51,.07)] sm:p-8">
          {/* Honeypot — invisible to real visitors, only a bot's autofill finds it. */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          {step === 1 ? <div key="step-1" className="animate-[rise_.35s_ease-out_both]">
            <div className="flex items-start justify-between gap-5"><div><h2 className="text-xl font-semibold tracking-[-0.04em]">{t("step1Heading")}</h2><p className="mt-1 text-sm text-ink-muted">{t("step1Subheading")}</p></div><span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[10px] font-bold text-accent">{t("step1Badge")}</span></div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">{t("clientName")}<input required name="clientName" value={values.clientName} onChange={(event) => updateField("clientName", event.target.value)} className={fieldClass} placeholder={t("clientNamePlaceholder")} /></label><label className="text-sm font-semibold">{t("companyName")}<input required name="companyName" value={values.companyName} onChange={(event) => updateField("companyName", event.target.value)} className={fieldClass} placeholder={t("companyNamePlaceholder")} /></label><label className="text-sm font-semibold">{t("telephone")}<input required name="telephone" type="tel" value={values.telephone} onChange={(event) => updateField("telephone", event.target.value)} className={fieldClass} placeholder={t("telephonePlaceholder")} /></label><label className="text-sm font-semibold">{t("email")}<input required name="email" type="email" value={values.email} onChange={(event) => updateField("email", event.target.value)} className={fieldClass} placeholder={t("emailPlaceholder")} /></label></div>
            <label className="mt-5 block text-sm font-semibold">{t("submitterName")}<span className="ml-1 text-accent">{t("submitterNameSuffix")}</span><input required name="submitterName" value={values.submitterName} onChange={(event) => updateField("submitterName", event.target.value)} className={fieldClass} placeholder={t("submitterNamePlaceholder")} /></label>

            <div className="mt-7 rounded-xl border border-line bg-surface-soft p-4">
              <p className="text-sm font-semibold">{t("attachDocumentQuestion")}</p>
              <div className="mt-3 inline-flex items-center rounded-full border border-line bg-surface p-1 text-sm font-semibold">
                <button type="button" onClick={() => setAttachDocument(true)} aria-current={attachDocument} className={`rounded-full px-4 py-2 transition-colors ${attachDocument ? "bg-brand text-white" : "text-ink-muted hover:text-accent"}`}>{t("attachDocumentYes")}</button>
                <button type="button" onClick={() => setAttachDocument(false)} aria-current={!attachDocument} className={`rounded-full px-4 py-2 transition-colors ${!attachDocument ? "bg-brand text-white" : "text-ink-muted hover:text-accent"}`}>{t("attachDocumentNo")}</button>
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xs text-xs leading-5 text-ink-muted">{t("publicDataNotice")}</p><button type="button" onClick={nextStep} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover">{t("continue")} <Arrow className="h-4 w-4" /></button></div>
          </div> : <div key={attachDocument ? "step-2-doc" : "step-2-nodoc"} className="animate-[rise_.35s_ease-out_both]">
            <div className="flex items-start justify-between gap-5"><div><h2 className="text-xl font-semibold tracking-[-0.04em]">{attachDocument ? t("step2Heading") : t("step2SkippedHeading")}</h2><p className="mt-1 text-sm text-ink-muted">{attachDocument ? t("step2Subheading") : t("step2SkippedText")}</p></div><span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[10px] font-bold text-accent">{t("step2Badge")}</span></div>
            {attachDocument && <>
              <label className="mt-7 block text-sm font-semibold">{t("documentCategory")}<select required name="category" value={values.category} onChange={(event) => updateField("category", event.target.value)} className={fieldClass}><option value="" disabled>{t("selectCategory")}</option>{CATEGORY_GROUPS.map((group) => <optgroup key={group.group} label={tGroups(group.group)}>{group.categories.map((category) => <option key={category} value={category}>{tCategories(category)}</option>)}</optgroup>)}</select></label>
              <label className={`mt-5 block rounded-2xl border border-dashed border-accent-soft bg-accent-soft/60 p-8 text-center transition-colors ${isCompressing ? "pointer-events-none opacity-60" : "cursor-pointer hover:bg-accent-soft"}`}>
                <input required disabled={isCompressing} type="file" accept=".pdf,.doc,.docx" onChange={chooseFile} className="sr-only" />
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-surface text-accent shadow-sm">{isCompressing ? <Upload className="h-5 w-5 animate-pulse" /> : <Upload className="h-5 w-5" />}</span>
                <span className="mt-4 block text-sm font-semibold">{isCompressing ? t("compressing") : selectedFile?.name || t("chooseDocument")}</span>
                <span className="mt-1 block text-xs text-ink-muted">{t("fileHint")}</span>
              </label>
              {selectedFile && !isCompressing && <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface-soft p-3 text-sm"><File className="h-5 w-5 text-accent" /><span className="min-w-0 flex-1 truncate font-medium">{selectedFile.name}</span><span className="font-mono text-[10px] text-ink-muted">{t("ready")}</span></div>}
              {compressionNotice && <p className="mt-2 text-xs text-ink-muted">{compressionNotice}</p>}
              <div className="mt-5 rounded-xl border border-amber-soft bg-amber-soft p-4 text-xs leading-5 text-amber"><strong>{t("beforeSubmitStrong")}</strong> {t("beforeSubmitText")}</div>
            </>}
            {error && <p className="mt-5 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p>}
            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => setStep(1)} className="rounded-full px-4 py-3 text-sm font-semibold text-ink-muted transition-colors hover:text-accent">{t("back")}</button><button type="submit" disabled={isSubmitting || isCompressing} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(15,118,110,.18)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? t("submitting") : t("submitButton")} <Arrow className="h-4 w-4" /></button></div>
          </div>}
        </form>
      </div>
    </section>
  </main>;
}
