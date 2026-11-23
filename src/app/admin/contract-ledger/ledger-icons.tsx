type P = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
);

export const IconDownload = ({ size = 18, className }: P) =>
  svg(size, className, (
    <>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ));

export const IconShield = ({ size = 14, className }: P) =>
  svg(size, className, <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />);

export const IconInfo = ({ size = 16, className }: P) =>
  svg(size, className, (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ));

export const IconChevronRight = ({ size = 16, className }: P) => svg(size, className, <path d="m9 6 6 6-6 6" />);
export const IconChevronDown = ({ size = 16, className }: P) => svg(size, className, <path d="m6 9 6 6 6-6" />);

export const IconRefresh = ({ size = 18, className }: P) =>
  svg(size, className, (
    <>
      <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ));

export const IconCard = ({ size = 30, className }: P) =>
  svg(size, className, (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M15 15h3" />
    </>
  ));

export const IconBank = ({ size = 30, className }: P) =>
  svg(size, className, (
    <>
      <path d="m3 9 9-5 9 5" />
      <path d="M4 9h16" />
      <path d="M6 9v8M10 9v8M14 9v8M18 9v8" />
      <path d="M3 20h18" />
    </>
  ));

export const IconCoins = ({ size = 30, className }: P) =>
  svg(size, className, (
    <>
      <ellipse cx="14" cy="6" rx="6" ry="2.5" />
      <path d="M8 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6" />
      <ellipse cx="10" cy="13" rx="6" ry="2.5" />
      <path d="M4 13v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" />
    </>
  ));

export const IconCheckCircle = ({ size = 30, className }: P) =>
  svg(size, className, (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ));

export const IconTransfer = ({ size = 18, className }: P) =>
  svg(size, className, (
    <>
      <path d="M4 8h14l-3-3" />
      <path d="M20 16H6l3 3" />
    </>
  ));

export const IconCalculator = ({ size = 20, className }: P) =>
  svg(size, className, (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </>
  ));

export const IconCalendarSmall = ({ size = 18, className }: P) =>
  svg(size, className, (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ));

export const IconSearchSmall = ({ size = 18, className }: P) =>
  svg(size, className, (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ));
