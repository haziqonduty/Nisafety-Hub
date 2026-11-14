"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type SVGProps } from "react";
import { BrandLogo } from "@/app/_components/brand-logo";
import { LanguageSwitcher } from "@/app/_components/language-switcher";
import { addEntry, removeEntry, RepeatableField, updateEntry } from "@/app/_components/repeatable-field";
import {
  appendServiceReport,
  knownErrorCode,
  newServiceRow,
  ServiceReportsFields,
  uploadServiceRows,
  validateServiceRows,
  type ServiceRow,
} from "@/app/_components/service-reports-fields";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Link, useRouter } from "@/i18n/routing";
import { todayInMalaysia } from "@/lib/format";

type IconProps = SVGProps<SVGSVGElement>;

function Arrow(props: IconProps) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}><path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

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
  "INVALID_SERVICE_DATE",
] as const;
type ErrorCode = (typeof KNOWN_ERROR_CODES)[number];

function errorCodeFrom(value: string | undefined): ErrorCode | "GENERIC" {
  return KNOWN_ERROR_CODES.includes(value as ErrorCode) ? (value as ErrorCode) : "GENERIC";
}

type SubmissionValues = {
  companyName: string;
  submitterName: string;
};

// Errors about the report itself (shown on its service row) rather than
// about the client details (shown under the form).
const REPORT_ERROR_CODES = new Set(["INVALID_CATEGORY", "INVALID_SERVICE_DATE", "INVALID_FILE_TYPE", "FILE_SIZE", "UPLOAD_ERROR", "DOCUMENT_SAVE_ERROR"]);

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
  const tServices = useTranslations("services");

  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<SubmissionValues>({ companyName: "", submitterName: "" });
  const [clientNames, setClientNames] = useState<string[]>([""]);
  const [telephones, setTelephones] = useState<string[]>([""]);
  const [emails, setEmails] = useState<string[]>([""]);
  const [serviceDate, setServiceDate] = useState(todayInMalaysia);
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>(() => [newServiceRow()]);
  // Set once the client (and its first report) is saved but a later service
  // failed — from then on, submitting again only retries what failed instead
  // of creating the client a second time.
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [attachDocument, setAttachDocument] = useState(true);
  const [existingClientId, setExistingClientId] = useState<string | null>(null);
  const [clientMatches, setClientMatches] = useState<ClientMatch[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);
  const isCompressing = serviceRows.some((row) => row.compressing);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function nextStep() {
    if (formRef.current?.reportValidity()) {
      setError("");
      setStep(2);
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

  // Scoped to the post-upload navigation only, not the whole submit — the
  // upload itself can legitimately take a while on a slow connection, and a
  // watchdog covering that too would misfire mid-upload. router.push() never
  // throws or resolves a promise we can await, so without this a slow (but
  // not failed) navigation after a successful upload left the button frozen
  // on its submitting label forever, recoverable only by a manual refresh —
  // same gap as src/app/login/page.tsx.
  useEffect(() => {
    if (!isNavigatingAway) return;
    const watchdog = setTimeout(() => {
      setIsNavigatingAway(false);
      setIsSubmitting(false);
      setError(tErrors("NETWORK_ERROR"));
    }, 12000);
    return () => clearTimeout(watchdog);
  }, [isNavigatingAway, tErrors]);

  function markRow(key: string, patch: Partial<ServiceRow>) {
    setServiceRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCompressing) return;
    if (attachDocument && !validateServiceRows(serviceRows, setServiceRows)) {
      setError("");
      return;
    }

    setError("");
    setIsSubmitting(true);

    let clientId = savedClientId;
    let rowsToUpload = serviceRows;

    if (!clientId) {
      // The client plus the FIRST service of the visit go together, exactly
      // like a single-report submission always has; every further service is
      // its own request afterwards (Vercel's 4.5MB body cap).
      const firstRow = attachDocument ? serviceRows[0] : undefined;
      const formData = new FormData();
      formData.append("website", honeypot);
      clientNames.filter(Boolean).forEach((name) => formData.append("clientName", name));
      formData.append("companyName", values.companyName);
      telephones.filter(Boolean).forEach((tel) => formData.append("telephone", tel));
      emails.filter(Boolean).forEach((email) => formData.append("email", email));
      formData.append("submitterName", values.submitterName);
      if (existingClientId) formData.append("clientId", existingClientId);
      if (firstRow) {
        markRow(firstRow.key, { status: "uploading", errorCode: "" });
        await appendServiceReport(formData, firstRow, serviceDate);
      }

      try {
        const response = await fetch("/api/submissions", { method: "POST", body: formData });
        const result = (await response.json()) as { error?: string; clientId?: string };
        if (!response.ok || !result.clientId) {
          const code = errorCodeFrom(result.error);
          if (firstRow && REPORT_ERROR_CODES.has(code)) {
            markRow(firstRow.key, { status: "error", errorCode: knownErrorCode(code) });
          } else {
            if (firstRow) markRow(firstRow.key, { status: "idle" });
            setError(tErrors(code));
          }
          setIsSubmitting(false);
          return;
        }
        clientId = result.clientId;
        if (firstRow) {
          markRow(firstRow.key, { status: "done" });
          rowsToUpload = serviceRows.map((row) => (row.key === firstRow.key ? { ...row, status: "done" as const } : row));
        }
      } catch {
        if (firstRow) markRow(firstRow.key, { status: "idle" });
        setError(tErrors("NETWORK_ERROR"));
        setIsSubmitting(false);
        return;
      }
    }

    if (attachDocument) {
      const allSaved = await uploadServiceRows(clientId, rowsToUpload, serviceDate, setServiceRows);
      if (!allSaved) {
        setSavedClientId(clientId);
        setError(tServices("partialSaved"));
        setIsSubmitting(false);
        return;
      }
    }

    // Left deliberately in its submitting state here rather than reset in
    // a finally — resetting made the button pop back to its idle label the
    // instant push() was called, not when /submission-success was ready.
    setIsNavigatingAway(true);
    router.push("/submission-success");
  }

  const pendingServiceCount = serviceRows.filter((row) => row.status !== "done").length;

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
            {attachDocument && <div className="mt-7">
              <ServiceReportsFields serviceDate={serviceDate} onServiceDateChange={setServiceDate} rows={serviceRows} setRows={setServiceRows} locked={isSubmitting || Boolean(savedClientId)} />
              <div className="mt-5 rounded-xl border border-amber-soft bg-amber-soft p-4 text-xs leading-5 text-amber"><strong>{t("beforeSubmitStrong")}</strong> {t("beforeSubmitText")}</div>
            </div>}
            {error && <p className="mt-5 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p>}
            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">{savedClientId ? <span /> : <button type="button" onClick={() => setStep(1)} className="rounded-full px-4 py-3 text-sm font-semibold text-ink-muted transition-colors hover:text-accent">{t("back")}</button>}<button type="submit" disabled={isSubmitting || isCompressing} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(15,118,110,.18)] transition-all hover:-translate-y-0.5 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? t("submitting") : savedClientId ? tServices("retryFailed", { count: pendingServiceCount }) : attachDocument ? tServices("submitServices", { count: serviceRows.length }) : t("submitButton")} <Arrow className="h-4 w-4" /></button></div>
          </div>}
        </form>
      </div>
    </section>
  </main>;
}
