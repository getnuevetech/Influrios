import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, className, ...props }: IconProps) {
  return { width: size, height: size, className, viewBox: "0 0 24 24", fill: "none", ...props };
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 12.6 12 20l-7.5-7.4a4.5 4.5 0 1 1 7.5-5.1 4.5 4.5 0 1 1 7.5 5.1Z" />
    </svg>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export function IconVerified(props: IconProps) {
  return (
    <svg {...base({ size: 16, ...props })} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5 14.6 5l3.4.5-.1 3.4 2.4 2.4-2.4 2.4.1 3.4-3.4.5L12 21.5 9.4 19l-3.4-.5.1-3.4L3.7 12.7l2.4-2.4-.1-3.4 3.4-.5L12 2.5Zm-1.2 11.3-2.6-2.6 1.4-1.4 1.2 1.2 3.8-3.8 1.4 1.4-5.2 5.2Z" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3.5 18.5c.8-3 2.9-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M14 14.2c1.7-.3 3.4.4 4.5 2.3" />
    </svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconHandshake(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13 5.5 10.5a2 2 0 0 1 0-2.8L8 5.2" />
      <path d="m16 13 2.5-2.5a2 2 0 0 0 0-2.8L16 5.2" />
      <path d="M8 8.5h8" />
      <path d="M7 14.5 9.8 17a2.2 2.2 0 0 0 3 0l1.4-1.4a1.6 1.6 0 0 0 0-2.3L12.5 11" />
      <path d="m17 14.5-1.5 1.5" />
    </svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V7.5L12 4l8 3.5V20" />
      <path d="M9 20v-5h6v5" />
      <path d="M8 10h.01M12 10h.01M16 10h.01M8 13.5h.01M12 13.5h.01M16 13.5h.01" />
    </svg>
  );
}

export function IconInstagram(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2Zm5.1-8.3a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0ZM12 3.5c-2.3 0-2.6 0-3.5.05a5.4 5.4 0 0 0-3.8 1.4 5.4 5.4 0 0 0-1.4 3.8C3.5 9.4 3.5 9.7 3.5 12s0 2.6.05 3.5a5.4 5.4 0 0 0 1.4 3.8 5.4 5.4 0 0 0 3.8 1.4c.9.05 1.2.05 3.5.05s2.6 0 3.5-.05a5.4 5.4 0 0 0 3.8-1.4 5.4 5.4 0 0 0 1.4-3.8c.05-.9.05-1.2.05-3.5s0-2.6-.05-3.5a5.4 5.4 0 0 0-1.4-3.8 5.4 5.4 0 0 0-3.8-1.4C14.6 3.5 14.3 3.5 12 3.5Zm0 1.5c2.25 0 2.52 0 3.4.05a3.9 3.9 0 0 1 2.7 1.05 3.9 3.9 0 0 1 1.05 2.7c.04.88.05 1.15.05 3.4s0 2.52-.05 3.4a3.9 3.9 0 0 1-1.05 2.7 3.9 3.9 0 0 1-2.7 1.05c-.88.04-1.15.05-3.4.05s-2.52 0-3.4-.05a3.9 3.9 0 0 1-2.7-1.05 3.9 3.9 0 0 1-1.05-2.7C5.2 14.52 5.2 14.25 5.2 12s0-2.52.05-3.4a3.9 3.9 0 0 1 1.05-2.7 3.9 3.9 0 0 1 2.7-1.05C9.48 5 9.75 5 12 5Z" />
    </svg>
  );
}

export function IconTikTok(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.6 8.3a6.7 6.7 0 0 1-3.9-1.2v6.5a5.6 5.6 0 1 1-4.8-5.5v2.6a3.1 3.1 0 1 0 2.2 3v-11h2.5a4.3 4.3 0 0 0 4 3.7v1.9Z" />
    </svg>
  );
}

export function IconYouTube(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.5 7.6a3 3 0 0 0-2.1-2.1C18.6 5 12 5 12 5s-6.6 0-8.4.5A3 3 0 0 0 1.5 7.6 31 31 0 0 0 1 12a31 31 0 0 0 .5 4.4 3 3 0 0 0 2.1 2.1C5.4 19 12 19 12 19s6.6 0 8.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23 12a31 31 0 0 0-.5-4.4ZM10 15.2V8.8L15.5 12 10 15.2Z" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.7 3.5h2.8l-6.1 7 7.2 10H16l-4.4-5.8L6.6 20.5H3.8l6.5-7.5L3.5 3.5H9l4 5.3 4.7-5.3Zm-1 15.3h1.6L7.4 5.1H5.7l11 13.7Z" />
    </svg>
  );
}

export function IconLinkedIn(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.3 9.3H2.5V21h2.8V9.3ZM3.9 3.5A1.7 1.7 0 1 0 3.9 7a1.7 1.7 0 0 0 0-3.5ZM21.5 21h-2.8v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3v5.8H11.8V9.3h2.7v1.6h.1c.4-.7 1.3-1.9 3.3-1.9 3.5 0 4.1 2.3 4.1 5.3V21Z" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Category glyph icons for the Explore grid */
export function CategoryGlyph({ slug, size = 22 }: { slug: string; size?: number }) {
  const common = { size, className: "text-white drop-shadow" };
  switch (slug) {
    case "beauty":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M8 20c2-6 3-10 4-14 1 4 2 8 4 14" />
          <path d="M9.5 14h5" />
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "fashion":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 7h8l1.5 3H6.5L8 7Z" />
          <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
          <path d="M7 10v9h10v-9" />
        </svg>
      );
    case "food":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M5 14h14v1.5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V14Z" />
          <path d="M8 14V9M12 14V7M16 14v-4" />
        </svg>
      );
    case "home-interior":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M4 12 12 5l8 7" />
          <path d="M6.5 10.5V19h11v-8.5" />
        </svg>
      );
    case "hair":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M7 5v10M7 15a3 3 0 0 0 6 0V8" />
          <path d="M17 5v14" />
        </svg>
      );
    case "suppliers":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M4 8h16v11H4V8Z" />
          <path d="M8 8V6h8v2" />
          <path d="M4 12h16" />
        </svg>
      );
    case "travel":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 19c-4 0-7-2.2-7-6 0-4.5 4-8.5 7-10 3 1.5 7 5.5 7 10 0 3.8-3 6-7 6Z" />
          <path d="M12 14v-3M10 12h4" />
        </svg>
      );
    case "fitness":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 12h2M18 12h2M7 9v6M17 9v6M9 7v10M15 7v10M11 10v4h2v-4" />
        </svg>
      );
    case "tech":
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <rect x="5" y="4" width="14" height="12" rx="1.5" />
          <path d="M9 20h6M12 16v4" />
        </svg>
      );
    default:
      return (
        <svg {...base(common)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="10" r="4" />
          <path d="M6 19c1.5-3 4-4.5 6-4.5S16.5 16 18 19" />
        </svg>
      );
  }
}

export function SocialIcon({
  platform,
  size = 16,
  className,
}: {
  platform: string;
  size?: number;
  className?: string;
}) {
  switch (platform) {
    case "INSTAGRAM":
      return <IconInstagram size={size} className={className} />;
    case "TIKTOK":
      return <IconTikTok size={size} className={className} />;
    case "YOUTUBE":
      return <IconYouTube size={size} className={className} />;
    case "X":
      return <IconX size={size} className={className} />;
    default:
      return <IconInstagram size={size} className={className} />;
  }
}
