"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { StatusScreen, statusPrimaryButton, statusSecondaryButton } from "@/app/_components/status-screen";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  // In production a server error only carries a reference code (digest), never details.
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    <StatusScreen
      code="SOMETHING WENT WRONG"
      title="This page couldn't load"
      titleMs="Halaman ini tidak dapat dimuatkan"
      body="Records that were already saved are safe. Try again, and if it keeps happening, send the reference code below to the admin."
      bodyMs="Rekod yang sudah disimpan adalah selamat. Cuba lagi, dan jika masih berlaku, hantar kod rujukan di bawah kepada admin."
    >
      <button type="button" onClick={() => retry()} className={statusPrimaryButton}>
        Try again · Cuba lagi
      </button>
      <Link href="/" className={statusSecondaryButton}>
        Back to workspace
      </Link>
      {digest && <p className="basis-full font-mono text-[11px] text-ink-faint">Ref: {digest}</p>}
    </StatusScreen>
  );
}
