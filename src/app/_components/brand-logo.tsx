import Image from "next/image";
import Link from "next/link";

const LOGO_ASPECT_RATIO = 400 / 192;

export function BrandLogo({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <Link href="/" className={`flex items-center transition-opacity hover:opacity-80 ${className ?? ""}`} aria-label="Nisafety Consultancy home">
      <Image
        src="/nisafety-consultancy-logo.png"
        alt="Nisafety Consultancy"
        width={Math.round(height * LOGO_ASPECT_RATIO)}
        height={height}
        priority
      />
    </Link>
  );
}
