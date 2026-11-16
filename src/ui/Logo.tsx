/**
 * The Leggio mark: a music stand reduced to three strokes — the tilted desk,
 * the stem and the foot — with a single red page edge. The wordmark is set
 * in Bodoni, the type of Italian opera librettos and score title pages.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M6.5 6.5 25 10.6l-2.2 9.9L4.3 16.4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9.6 9.9 11.6 2.6" stroke="var(--accent, #7a1f2b)" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.2 18.6 12.7 28M8 28h9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 28, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="logo" style={{ fontSize: size * 0.86 }}>
      <LogoMark size={size} />
      <span className="logo__word">Leggio</span>
      {tagline && <span className="logo__tag">for classical musicians</span>}
    </span>
  );
}
