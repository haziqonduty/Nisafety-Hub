import Link from "next/link";
import { StatusScreen, statusPrimaryButton } from "@/app/_components/status-screen";

export default function NotFound() {
  return (
    <StatusScreen
      code="ERROR 404"
      title="This page doesn't exist"
      titleMs="Halaman ini tidak wujud"
      body="The link may be old, or the record may have been moved to the recycle bin."
      bodyMs="Pautan mungkin lama, atau rekod mungkin telah dipindahkan ke tong kitar semula."
    >
      <Link href="/" className={statusPrimaryButton}>
        Back to workspace · Kembali
      </Link>
    </StatusScreen>
  );
}
