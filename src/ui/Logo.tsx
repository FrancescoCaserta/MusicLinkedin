/** The Leggio mark: an ink square beside the wordmark, set in Inter Tight. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const s = Math.round(size * 0.45);
  return <span className="logo__mark" style={{ width: s, height: s }} aria-hidden />;
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
