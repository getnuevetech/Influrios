import type { ReactNode } from "react";

/** Full-width page shell used across Influrios surfaces. */
export function PageShell({
  children,
  className = "",
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  /** Rare case: constrain forms (login, claim) while keeping page edge-to-edge padding. */
  narrow?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full px-4 sm:px-6 lg:px-10 ${
        narrow ? "max-w-xl" : "max-w-[90rem]"
      } ${className}`}
    >
      {children}
    </div>
  );
}
