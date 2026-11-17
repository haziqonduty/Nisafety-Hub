"use client"; // Error boundaries must be Client Components

import "./globals.css";
import { StatusScreen, statusPrimaryButton } from "@/app/_components/status-screen";

/** Last resort: shown only if the root layout itself fails. Must render its own <html> and <body>. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col antialiased">
        <title>Something went wrong | Nisafety Hub</title>
        <StatusScreen
          code="SOMETHING WENT WRONG"
          title="Nisafety Hub couldn't load"
          titleMs="Nisafety Hub tidak dapat dimuatkan"
          body="Records that were already saved are safe. Please try again in a moment."
          bodyMs="Rekod yang sudah disimpan adalah selamat. Sila cuba lagi sebentar lagi."
        >
          <button type="button" onClick={() => retry()} className={statusPrimaryButton}>
            Try again · Cuba lagi
          </button>
        </StatusScreen>
      </body>
    </html>
  );
}
