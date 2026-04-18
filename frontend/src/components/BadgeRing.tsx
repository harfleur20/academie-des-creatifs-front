import { useEffect, useRef, useState } from "react";

export type BadgeLevel =
  | "aventurier"
  | "debutant"
  | "intermediaire"
  | "semi_pro"
  | "professionnel";

const BADGE_META: Record<BadgeLevel, { label: string; image: string; color: string }> = {
  aventurier: {
    label: "Aventurier",
    image: "/Badges/bg-avanturier.svg",
    color: "#35bbd9",
  },
  debutant: {
    label: "Débutant",
    image: "/Badges/bg-debutant.svg",
    color: "#264156",
  },
  intermediaire: {
    label: "Intermédiaire",
    image: "/Badges/bg-interm%C3%A9diare.svg",
    color: "#1f1912",
  },
  semi_pro: {
    label: "Semi-pro",
    image: "/Badges/bg-semi-pro.svg",
    color: "#4b398d",
  },
  professionnel: {
    label: "Professionnel",
    image: "/Badges/bg-professionnel.svg",
    color: "#022733",
  },
};

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Props = {
  badgeLevel: BadgeLevel | null;
  ringPct: number;        // 0-100
  hint: string | null;
  size?: number;          // px, default 110
  showHint?: boolean;
};

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function BadgeRing({
  badgeLevel,
  ringPct,
  hint,
  size = 110,
  showHint = true,
}: Props) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const prevLevel = useRef<BadgeLevel | null>(null);

  // Animate ring fill on mount / change
  useEffect(() => {
    const t = setTimeout(() => setAnimatedPct(ringPct), 60);
    return () => clearTimeout(t);
  }, [ringPct]);

  // Detect badge unlock
  useEffect(() => {
    if (prevLevel.current !== null && prevLevel.current !== badgeLevel) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 2500);
      return () => clearTimeout(t);
    }
    prevLevel.current = badgeLevel;
  }, [badgeLevel]);

  const meta = badgeLevel ? BADGE_META[badgeLevel] : null;
  const strokeColor = meta ? meta.color : "#e5e7eb";
  const supportColor = meta ? colorWithAlpha(meta.color, 0.16) : "#f1f5f9";
  const trackColor = meta ? colorWithAlpha(meta.color, 0.32) : "#e5e7eb";
  const safePct = Math.max(0, Math.min(100, animatedPct || 0));
  const dashOffset = CIRCUMFERENCE - (safePct / 100) * CIRCUMFERENCE;

  if (!badgeLevel || !meta) {
    return (
      <div className="badge-ring badge-ring--empty">
        <div className="badge-ring__wrapper" style={{ width: size, height: size }}>
          <svg
            viewBox="0 0 100 100"
            width={size}
            height={size}
            className="badge-ring__svg"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle cx="50" cy="50" r="34" fill={supportColor} />
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke={trackColor} strokeWidth="6" />
            {safePct > 0 && (
              <circle
                cx="50" cy="50" r={RADIUS}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)" }}
              />
            )}
          </svg>
          <div className="badge-ring__center badge-ring__center--empty">
            <span>{safePct > 0 ? `${Math.round(safePct)}%` : "?"}</span>
          </div>
        </div>
        {showHint && hint && (
          <p className="badge-ring__hint">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`badge-ring${justUnlocked ? " badge-ring--unlocked" : ""}`}>
      <div className="badge-ring__wrapper" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          className="badge-ring__svg"
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle cx="50" cy="50" r="34" fill={supportColor} />
          {/* Track */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke={trackColor}
            strokeWidth="6"
          />
          {/* Progress arc */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)" }}
          />
        </svg>

        {/* Badge image */}
        <div className="badge-ring__center">
          <img
            src={meta.image}
            alt={meta.label}
            draggable={false}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>

        {/* Unlock burst */}
        {justUnlocked && (
          <div className="badge-ring__burst" aria-hidden>
            {[...Array(8)].map((_, i) => (
              <span key={i} className="badge-ring__spark" style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
        )}
      </div>

      {/* Level label */}
      <p className="badge-ring__label" style={{ color: strokeColor }}>
        {meta.label}
      </p>

      {/* Next badge hint */}
      {showHint && hint && (
        <p className="badge-ring__hint">{hint}</p>
      )}

      {/* Unlock toast */}
      {justUnlocked && (
        <div className="badge-ring__toast">
          Nouveau badge débloqué — {meta.label} !
        </div>
      )}
    </div>
  );
}
