import type { Dispatch, SetStateAction } from "react";
import { Close, Plus } from "@/app/_components/icons";
import { MAX_ADDITIONAL_CONTACTS } from "@/lib/client-merge";

/** The main contact plus up to MAX_ADDITIONAL_CONTACTS extras. */
export const MAX_CONTACT_ENTRIES = MAX_ADDITIONAL_CONTACTS + 1;

export function addEntry(setList: Dispatch<SetStateAction<string[]>>) {
  setList((current) => (current.length < MAX_CONTACT_ENTRIES ? [...current, ""] : current));
}
export function removeEntry(setList: Dispatch<SetStateAction<string[]>>, index: number) {
  setList((current) => current.filter((_, i) => i !== index));
}
export function updateEntry(setList: Dispatch<SetStateAction<string[]>>, index: number, value: string) {
  setList((current) => current.map((item, i) => (i === index ? value : item)));
}

const repeatableInputClass = "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

// A company report sometimes has more than one contact — e.g. two people, or
// two phone numbers. The first entry is required unless `optional`; staff can
// add up to MAX_CONTACT_ENTRIES total, and remove any entry past the first.
export function RepeatableField({
  label,
  name,
  type = "text",
  placeholder,
  removeLabel,
  addLabel,
  values,
  onChange,
  onAdd,
  onRemove,
  onFocusFirst,
  onBlurFirst,
  optional = false,
  optionalLabel,
}: {
  label: string;
  name: string;
  type?: "text" | "tel" | "email";
  placeholder: string;
  removeLabel: string;
  addLabel: string;
  values: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onFocusFirst?: () => void;
  onBlurFirst?: () => void;
  /** The field may be left empty (e.g. a client with no email). */
  optional?: boolean;
  optionalLabel?: string;
}) {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {label}
        {optional && optionalLabel && (
          <span className="rounded-full bg-surface-soft px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-ink-muted">{optionalLabel}</span>
        )}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              required={index === 0 && !optional}
              name={name}
              type={type}
              value={value}
              onChange={(event) => onChange(index, event.target.value)}
              onFocus={index === 0 ? onFocusFirst : undefined}
              onBlur={index === 0 ? onBlurFirst : undefined}
              className={repeatableInputClass}
              placeholder={placeholder}
            />
            {index > 0 && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={removeLabel}
                className="shrink-0 rounded-full border border-line p-2.5 text-ink-muted transition-colors hover:border-danger hover:bg-danger-soft hover:text-danger"
              >
                <Close className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {values.length < MAX_CONTACT_ENTRIES && (
        <button type="button" onClick={onAdd} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition-colors hover:text-accent-hover">
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </button>
      )}
    </div>
  );
}
