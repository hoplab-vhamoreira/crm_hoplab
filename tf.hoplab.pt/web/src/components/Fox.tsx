/**
 * Raposo — mascote da variante Aventura (criança).
 * SVG próprio com animação subtil; sem dependências externas.
 */
export function Fox({ size = 96, mood = 'happy' }: { size?: number; mood?: 'happy' | 'cheer' }) {
  return (
    <div style={{ width: size, height: size, display: 'inline-block', animation: mood === 'cheer' ? 'fox-bounce .6s ease infinite alternate' : 'fox-sway 3s ease-in-out infinite' }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Raposo, a mascote">
        {/* orelhas */}
        <polygon points="22,38 36,8 48,34" fill="#E8833A" />
        <polygon points="98,38 84,8 72,34" fill="#E8833A" />
        <polygon points="28,34 37,15 45,33" fill="#7A4419" />
        <polygon points="92,34 83,15 75,33" fill="#7A4419" />
        {/* cabeça */}
        <ellipse cx="60" cy="62" rx="42" ry="38" fill="#F09A4B" />
        {/* faces brancas */}
        <ellipse cx="38" cy="74" rx="18" ry="16" fill="#FFF6EC" />
        <ellipse cx="82" cy="74" rx="18" ry="16" fill="#FFF6EC" />
        <ellipse cx="60" cy="84" rx="22" ry="14" fill="#FFF6EC" />
        {/* olhos */}
        {mood === 'cheer' ? (
          <>
            <path d="M32 58 q8 -8 16 0" stroke="#3A2415" strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <path d="M72 58 q8 -8 16 0" stroke="#3A2415" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="40" cy="58" r="5" fill="#3A2415" />
            <circle cx="80" cy="58" r="5" fill="#3A2415" />
            <circle cx="42" cy="56" r="1.6" fill="#fff" />
            <circle cx="82" cy="56" r="1.6" fill="#fff" />
          </>
        )}
        {/* focinho */}
        <ellipse cx="60" cy="74" rx="7" ry="5.4" fill="#3A2415" />
        {/* sorriso */}
        <path d="M48 86 q12 10 24 0" stroke="#3A2415" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <style>{`
        @keyframes fox-sway { 0%,100% { transform: rotate(-2deg) } 50% { transform: rotate(2deg) } }
        @keyframes fox-bounce { from { transform: translateY(0) } to { transform: translateY(-8px) } }
        @media (prefers-reduced-motion: reduce) { div[aria-label] { animation: none } }
      `}</style>
    </div>
  )
}

/** Confettis de celebração — CSS puro, leve, ~2s */
export function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => i)
  const colors = ['#F09A4B', '#1D6A8C', '#FFB24A', '#7FB6D0', '#CF7A1E', '#1A7A4A']
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
      {pieces.map(i => (
        <span key={i} style={{
          position: 'absolute',
          left: `${(i * 41) % 100}%`,
          top: -12,
          width: 8, height: 12,
          background: colors[i % colors.length],
          borderRadius: 2,
          transform: `rotate(${(i * 67) % 360}deg)`,
          animation: `confetti-fall ${1.6 + (i % 5) * 0.3}s ease-in ${(i % 7) * 0.12}s forwards`,
          opacity: 0,
        }} />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0%   { opacity: 1; transform: translateY(0) rotate(0deg) }
          100% { opacity: 0; transform: translateY(75vh) rotate(540deg) }
        }
      `}</style>
    </div>
  )
}
