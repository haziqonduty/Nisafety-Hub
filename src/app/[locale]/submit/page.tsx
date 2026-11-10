"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type SVGProps } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { addEntry, removeEntry, RepeatableField, updateEntry } from "@/app/_components/repeatable-field";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Link, useRouter } from "@/i18n/routing";
import { compressPdf } from "@/lib/compress-pdf";
import { generatePdfThumbnail } from "@/lib/generate-pdf-thumbnail";
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
  "DOCUMENT_REQUIRED_FOR_EXISTING_CLIENT",
  "TOO_MANY_CONTACTS",
] as const;
type ErrorCode = (typeof KNOWN_ERROR_CODES)[number];

function errorCodeFrom(value: string | undefined): ErrorCode | "GENERIC" {
  return KNOWN_ERROR_CODES.includes(value as ErrorCode) ? (value as ErrorCode) : "GENERIC";
}

type SubmissionValues = {
  companyName: string;
  submitterName: string;
  category: string;
};

type ClientMatch = {
  id: string;
  clientName: string;
  companyName: string;
  telephone: string;
  email: string;
  submitterName: string;
};

export default function SubmitPage() {
  const t = useTranslations("submit");
  const tErrors = useTranslations("submissionErrors");
  const tGroups = useTranslations("categories.groups");
  const tCategories = useTranslations("categories.items");

  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<SubmissionValues>({ companyName: "", submitterName: "", category: "" });
  const [clientNames, setClientNames] = useState<string[]>([""]);
  const [telephones, setTelephones] = useState<string[]>([""]);
  const [emails, setEmails] = useState<string[]>([""]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachDocument, setAttachDocument] = useState(true);
  const [existingClientId, setExistingClientId] = useState<string | null>(null);
  const [clientMatches, setClientMatches] = useState<ClientMatch[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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

  const clientSearchTerm = (values.companyName || clientNames[0]).trim();
  // Once linked (or the typed term is too short to search), the dropdown has
  // nothing to show — derived at render time rather than cleared imperatively
  // from the effect below, so the effect only ever sets state from its async
  // fetch callback, never synchronously in its body.
  const visibleClientMatches = !existingClientId && clientSearchTerm.length >= 2 ? clientMatches : [];

  // Lets staff find a company already in the system instead of retyping its
  // details for every different service report — same debounce + abort
  // pattern as the command palette's document search.
  useEffect(() => {
    if (existingClientId || clientSearchTerm.length < 2) return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/clients/search?q=${encodeURIComponent(clientSearchTerm)}`, { signal: controller.signal });
        const data = (await response.json()) as { clients: ClientMatch[] };
        setClientMatches(data.clients ?? []);
      } catch {
        // ignore aborted/failed requests
      }
    }, 150);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [clientSearchTerm, existingClientId]);

  function selectClientMatch(match: ClientMatch) {
    setValues((current) => ({ ...current, companyName: match.companyName, submitterName: match.submitterName }));
    setClientNames([match.clientName]);
    setTelephones([match.telephone]);
    setEmails([match.email]);
    setExistingClientId(match.id);
    setClientMatches([]);
    setIsSearchFocused(false);
    // Reusing a client only makes sense when adding a new document to it —
    // a contact-only resubmission would create nothing new.
    setAttachDocument(true);
  }

  function clearExistingClient() {
    setExistingClientId(null);
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
    clientNames.filter(Boolean).forEach((name) => formData.append("clientName", name));
    formData.append("companyName", values.companyName);
    telephones.filter(Boolean).forEach((tel) => formData.append("telephone", tel));
    emails.filter(Boolean).forEach((email) => formData.append("email", email));
    formData.append("submitterName", values.submitterName);
    if (existingClientId) formData.append("clientId", existingClientId);
    if (attachDocument && selectedFile) {
      formData.append("category", values.category);
      formData.append("file", selectedFile);

      if (selectedFile.type === "application/pdf") {
        const thumbnail = await generatePdfThumbnail(selectedFile).catch(() => null);
        if (thumbnail) formData.append("thumbnail", thumbnail);
      }
    }

    try {
      const response = await fetch("/api/submissions", { method: "POST", body: formData });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(tErrors(errorCodeFrom(result.error)));
        setIsSubmitting(false);
        return;
      }
      // Left deliberately in its submitting state here rather than reset in
      // a finally — resetting unconditionally made the button pop back to
      // its idle label the instant push() was called, not when
      // /submission-success was actually ready, which read as a stuck or
      // failed submit during the real wait for the destination page.
      router.push("/submission-success");
    } catch {
      setError(tErrors("NETWORK_ERROR"));
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
            <div className="relative mt-7">
              <label className="text-sm font-semibold">
                {t("companyName")}
                <input
                  required
                  name="companyName"
                  value={values.companyName}
                  onChange={(event) => updateField("companyName", event.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
                  className={fieldClass}
                  placeholder={t("companyNamePlaceholder")}
                />
              </label>

              <div className="mt-5">
                <RepeatableField
                  label={t("clientName")}
                  name="clientName"
                  placeholder={t("clientNamePlaceholder")}
                  removeLabel={t("removeEntry")}
                  addLabel={t("addAnotherClientName")}
                  values={clientNames}
                  onChange={(index, value) => updateEntry(setClientNames, index, value)}
                  onAdd={() => addEntry(setClientNames)}
                  onRemove={(index) => removeEntry(setClientNames, index)}
                  onFocusFirst={() => setIsSearchFocused(true)}
                  onBlurFirst={() => setTimeout(() => setIsSearchFocused(false), 150)}
                />
              </div>

              {isSearchFocused && visibleClientMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_20px_40px_rgba(16,42,51,.12)]">
                  <p className="border-b border-line bg-surface-soft px-4 py-2 font-mono text-[10px] font-bold tracking-[0.1em] text-ink-muted">{t("existingClientsFound")}</p>
                  {visibleClientMatches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => selectClientMatch(match)}
                      className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent-soft"
                    >
                      <span className="text-sm font-semibold text-ink">{match.clientName} — {match.companyName}</span>
                      <span className="text-xs text-ink-muted">{match.telephone}{match.email ? ` · ${match.email}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {existingClientId && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm">
                <span className="font-semibold text-accent">{t("linkedToExistingClient")}</span>
                <button type="button" onClick={clearExistingClient} className="font-semibold text-ink-muted transition-colors hover:text-accent">{t("notThisClient")}</button>
              </div>
            )}

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <RepeatableField
                label={t("telephone")}
                name="telephone"
                type="tel"
                placeholder={t("telephonePlaceholder")}
                removeLabel={t("removeEntry")}
                addLabel={t("addAnotherTelephone")}
                values={telephones}
                onChange={(index, value) => updateEntry(setTelephones, index, value)}
                onAdd={() => addEntry(setTelephones)}
                onRemove={(index) => removeEntry(setTelephones, index)}
              />
              <RepeatableField
                label={t("email")}
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                removeLabel={t("removeEntry")}
                addLabel={t("addAnotherEmail")}
                values={emails}
                onChange={(index, value) => updateEntry(setEmails, index, value)}
                onAdd={() => addEntry(setEmails)}
                onRemove={(index) => removeEntry(setEmails, index)}
              />
            </div>

            <label className="mt-5 block text-sm font-semibold">{t("submitterName")}<span className="ml-1 text-accent">{t("submitterNameSuffix")}</span><input required name="submitterName" value={values.submitterName} onChange={(event) => updateField("submitterName", event.target.value)} className={fieldClass} placeholder={t("submitterNamePlaceholder")} /></label>

            {!existingClientId && (
              <div className="mt-7 rounded-xl border border-line bg-surface-soft p-4">
                <p className="text-sm font-semibold">{t("attachDocumentQuestion")}</p>
                <div className="mt-3 inline-flex items-center rounded-full border border-line bg-surface p-1 text-sm font-semibold">
                  <button type="button" onClick={() => setAttachDocument(true)} aria-current={attachDocument} className={`rounded-full px-4 py-2 transition-colors ${attachDocument ? "bg-brand text-white" : "text-ink-muted hover:text-accent"}`}>{t("attachDocumentYes")}</button>
                  <button type="button" onClick={() => setAttachDocument(false)} aria-current={!attachDocument} className={`rounded-full px-4 py-2 transition-colors ${!attachDocument ? "bg-brand text-white" : "text-ink-muted hover:text-accent"}`}>{t("attachDocumentNo")}</button>
                </div>
              </div>
            )}

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
