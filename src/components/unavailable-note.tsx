import Link from "next/link";

/** A failed read. The reference is an incident id, not the backend error. */
export function UnavailableNote({
  label,
  incident,
  href,
}: {
  label: string;
  incident: string;
  href: string;
}) {
  return (
    <p className="text-sm text-amber-900">
      {label} is unavailable. This is not zero. Reference {incident}.{" "}
      <Link href={href} className="font-semibold text-violet">
        Retry
      </Link>
    </p>
  );
}
