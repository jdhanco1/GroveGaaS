import Image from "next/image";
import Link from "next/link";

interface GroveBrandProps {
  href?: string;
  large?: boolean;
  priority?: boolean;
}

export default function GroveBrand({ href = "/", large = false, priority = false }: GroveBrandProps) {
  const logo = (
    <Image
      src="/grovegaas-logo.png"
      alt="GroveGaaS"
      width={1200}
      height={312}
      priority={priority}
    />
  );

  return href ? (
    <Link href={href} className={`gg-brand${large ? " gg-brand--large" : ""}`} aria-label="GroveGaaS home">
      {logo}
    </Link>
  ) : (
    <span className={`gg-brand${large ? " gg-brand--large" : ""}`}>{logo}</span>
  );
}