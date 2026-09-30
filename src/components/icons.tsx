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

/** Official-style solid blue verification badge (brand electric blue — use everywhere). */
export function IconVerified(props: IconProps) {
  const size = props.size ?? 18;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={props.className}
      aria-label="Verified"
      role="img"
    >
      <circle cx="12" cy="12" r="11" fill="#2979FF" />
      <path
        d="M10.1 15.8 6.8 12.5l1.4-1.4 1.9 1.9 5-5.1 1.4 1.4-6.4 6.5Z"
        fill="#fff"
      />
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

export function IconArrowLeft(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 6l-6 6 6 6" />
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

/** Brand-colored Instagram glyph */
export function IconInstagram({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="igBrand" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#igBrand)" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="#fff" />
    </svg>
  );
}

export function IconTikTok({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#25F4EE"
        d="M19.2 7.9a6.4 6.4 0 0 1-3.7-1.2v6.8a5.4 5.4 0 1 1-4.6-5.3v2.5a3 3 0 1 0 2.1 2.9V3.5h2.4c.1 1.5.8 2.9 1.9 3.9.6.5 1.2.8 1.9 1v-.5Z"
        transform="translate(0.6 0.4)"
      />
      <path
        fill="#FE2C55"
        d="M18.4 7.5a6.4 6.4 0 0 1-3.7-1.2v6.8a5.4 5.4 0 1 1-4.6-5.3v2.5a3 3 0 1 0 2.1 2.9V3.1h2.4c.1 1.5.8 2.9 1.9 3.9.6.5 1.2.8 1.9 1v-.5Z"
        transform="translate(-0.5 -0.3)"
      />
      <path
        fill="#000"
        d="M18.8 7.7a6.4 6.4 0 0 1-3.7-1.2v6.8a5.4 5.4 0 1 1-4.6-5.3v2.5a3 3 0 1 0 2.1 2.9V3.3h2.4c.1 1.5.8 2.9 1.9 3.9.6.5 1.2.8 1.9 1v-.5Z"
      />
    </svg>
  );
}

export function IconYouTube({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1.5" y="5" width="21" height="14" rx="3.5" fill="#FF0000" />
      <path d="M10 9.2v5.6L15.2 12 10 9.2Z" fill="#fff" />
    </svg>
  );
}

export function IconX({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="5" fill="#000" />
      <path
        fill="#fff"
        d="M16.8 6.2h1.9L13.9 11l5.2 6.8h-4.1l-3.2-4.2-3.7 4.2H6.2l5.1-5.8L6.5 6.2h4.2l2.9 3.8 3.2-3.8Zm-.7 10.8h1.1L8.1 7.3H7L16.1 17Z"
      />
    </svg>
  );
}

export function IconLinkedIn({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.2 9.4H4.8V19h2.4V9.4ZM6 4.8a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM19.2 19h-2.4v-4.8c0-1.1 0-2.6-1.6-2.6s-1.8 1.2-1.8 2.5V19h-2.4V9.4h2.3v1.3h.1c.3-.6 1.1-1.6 2.8-1.6 3 0 3.5 2 3.5 4.5V19Z"
      />
    </svg>
  );
}

/** Brand-blue link / chain glyph for card bottom strip */
export function IconLink({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#2979FF" />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M10 14.2a3.2 3.2 0 0 1 0-4.5l1.6-1.6a3.2 3.2 0 0 1 4.5 4.5l-.8.8M14 9.8a3.2 3.2 0 0 1 0 4.5L12.4 16a3.2 3.2 0 1 1-4.5-4.5l.8-.8"
      />
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

/** Influrios Card — ID / profile card glyph */
export function IconIdCard(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M14 10h4M14 13.5h4" />
      <path d="M6.5 15.5c.7-1.2 1.8-1.8 2.5-1.8s1.8.6 2.5 1.8" />
    </svg>
  );
}

/** Influence Intelligence — search over chart */
export function IconIntelligence(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17V13M9 17V9M13 17v-5" />
      <circle cx="16.5" cy="8.5" r="3.2" />
      <path d="m18.8 10.8 2.7 2.7" />
    </svg>
  );
}

/** Collaboration Network — three people */
export function IconNetwork(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="2.4" />
      <circle cx="6" cy="15" r="2.2" />
      <circle cx="18" cy="15" r="2.2" />
      <path d="M12 9.5v2.2M10.5 13.2 7.8 14M13.5 13.2l2.7.8" />
    </svg>
  );
}

/** Protected Payments — shield with dollar */
export function IconShieldPay(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 19 6.5v5.2c0 4.2-2.9 7.3-7 8.8-4.1-1.5-7-4.6-7-8.8V6.5L12 3.5Z" />
      <path d="M12 9.2v6M10.2 11.2h2.6a1.4 1.4 0 0 1 0 2.8h-1.6a1.4 1.4 0 0 0 0 2.8H14" />
    </svg>
  );
}

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

export function IconMail(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function IconShare(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 13.2 7.5 4.1M15.7 6.7l-7.5 4.1" />
    </svg>
  );
}

export function IconUserPlus(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M17 8v6M14 11h6" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.45)" />
      <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="#fff" />
    </svg>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3Z" />
    </svg>
  );
}

export function IconCake(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v3M8 8h8v3H8V8Z" />
      <path d="M5 11h14v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8Z" />
      <path d="M5 15h14" />
    </svg>
  );
}

export function IconLang(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.2 2.5 3.3 5.2 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.2-3.3-9S9.8 5.5 12 3Z" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

/** Solid play glyph for stat tiles (no dark circle). */
export function IconPlaySolid(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.5 5.8v12.4L19 12 8.5 5.8Z" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5h2.2l1.3-2h9l1.3 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z" />
      <circle cx="12" cy="13.2" r="3.2" />
    </svg>
  );
}

export function IconBag(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9.5h12l-.8 9.2a1.5 1.5 0 0 1-1.5 1.3H8.3a1.5 1.5 0 0 1-1.5-1.3L6 9.5Z" />
      <path d="M9 9.5V8a3 3 0 0 1 6 0v1.5" />
    </svg>
  );
}

export function IconPlane(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 12.5 3.8 9.8l1-1.8 5.2 1.4L14.5 3l1.8.9-1.8 7.2 4.2 2.2.9-1.4 1.5.7-1.6 3.4-3.5-1.2-7.1 2.2-.7-1.6 1.4-.8Z" />
    </svg>
  );
}

export function IconMegaphone(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 10.5v3l4 1.2 8.5 3.3V6L8.5 9.3 4.5 10.5Z" />
      <path d="M8.5 14.7v3.3l2.2-1.2" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

/** Small blue play in white circle for content cards */
export function IconPlayBadge(props: IconProps) {
  const size = props.size ?? 22;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#fff" />
      <path d="M10 8.2v7.6L16.8 12 10 8.2Z" fill="#2979FF" />
    </svg>
  );
}

export function SocialIcon({
  platform,
  size = 20,
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
    case "LINKEDIN":
      return <IconLinkedIn size={size} className={className} />;
    case "WEBSITE":
      return <IconGlobe size={size} className={className} />;
    default:
      return <IconGlobe size={size} className={className} />;
  }
}
