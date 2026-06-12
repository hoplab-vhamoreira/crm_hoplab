/**
 * Mundo de Exploração — variante Aventura (criança).
 *
 * COMPLIANCE: o mapa deriva exclusivamente de CONCLUSÃO (datas de sessão em
 * adherence_logs). Nunca lê self_rating nem qualquer métrica de qualidade
 * clínica — premeia hábito, não desempenho (spec §2/§14.3).
 *
 * O Raposo avança uma casa por sessão concluída (dia com ≥1 exercício feito).
 * O mundo é um ciclo de 4 zonas × 10 casas que se repete — nunca acaba.
 */
import { Fox } from './Fox'
import { Icon } from './Icon'

export interface Zone { key: string; label: string; sky: string; ground: string }

export const ZONES: Zone[] = [
  { key: 'floresta', label: 'Floresta',      sky: '#EAF5EE', ground: '#1A7A4A' },
  { key: 'rio',      label: 'Rio',           sky: '#E8F3F8', ground: '#1D6A8C' },
  { key: 'montanha', label: 'Montanha',      sky: '#F4EFE8', ground: '#8C6A4A' },
  { key: 'ceu',      label: 'Céu estrelado', sky: '#1C3A52', ground: '#0E2C3C' },
]

export const MILESTONES: { at: number; name: string }[] = [
  { at: 1,   name: 'Primeira Aventura' },
  { at: 5,   name: 'Amigo da Floresta' },
  { at: 10,  name: 'Explorador do Rio' },
  { at: 20,  name: 'Trepador da Montanha' },
  { at: 30,  name: 'Caçador de Estrelas' },
  { at: 50,  name: 'Grande Aventureiro' },
  { at: 75,  name: 'Lenda do Trilho' },
  { at: 100, name: 'Herói do Mundo' },
]

const zoneOf = (house: number) => ZONES[Math.floor(Math.max(house, 0) / 10) % ZONES.length]

/* Decoração de fundo por zona, desenhada por casa */
function Scenery({ x, zone }: { x: number; zone: Zone }) {
  switch (zone.key) {
    case 'floresta': return (
      <g>
        <polygon points={`${x - 8},58 ${x},34 ${x + 8},58`} fill="#1A7A4A" opacity=".55" />
        <rect x={x - 2} y={58} width={4} height={8} fill="#8C6A4A" opacity=".55" />
      </g>
    )
    case 'rio': return (
      <path d={`M ${x - 14} 50 q 5 -6 10 0 q 5 6 10 0 q 4 -5 8 0`} stroke="#1D6A8C" strokeWidth="2.5" fill="none" opacity=".5" strokeLinecap="round" />
    )
    case 'montanha': return (
      <g opacity=".55">
        <polygon points={`${x - 14},58 ${x},30 ${x + 14},58`} fill="#8C6A4A" />
        <polygon points={`${x - 5},40 ${x},30 ${x + 5},40`} fill="#fff" />
      </g>
    )
    default: return (
      <g fill="#FFB24A" opacity=".8">
        <circle cx={x - 10} cy={36} r={2} />
        <circle cx={x + 6} cy={28} r={1.5} />
        <circle cx={x + 14} cy={44} r={2} />
      </g>
    )
  }
}

export function ExplorationMap({ position, foxMood = 'happy' }: { position: number; foxMood?: 'happy' | 'cheer' }) {
  // Janela deslizante de 7 casas centrada na atual (posição = casa atual, 0-based no arranque)
  const current = Math.max(position, 0)
  const first = Math.max(current - 3, 0)
  const slots = Array.from({ length: 7 }, (_, i) => first + i)

  // Trilho sinuoso: x equidistante, y alterna suavemente
  const xs = slots.map((_, i) => 26 + i * 48)
  const ys = [108, 76, 102, 68, 98, 72, 106]
  const path = xs.map((x, i) => i === 0
    ? `M ${x} ${ys[i]}`
    : `Q ${(xs[i - 1] + x) / 2} ${(ys[i - 1] + ys[i]) / 2 + (i % 2 ? 18 : -18)} ${x} ${ys[i]}`
  ).join(' ')

  const curIdx = slots.indexOf(current)
  const curZone = zoneOf(current)
  const isNight = curZone.key === 'ceu'

  return (
    <div
      className="card"
      role="img"
      aria-label={`Estás na casa ${current + 1}, zona ${curZone.label}`}
      style={{ position: 'relative', padding: '14px 10px 10px', marginBottom: 20, overflow: 'hidden', background: curZone.sky, border: '1.5px solid var(--eira-sun)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 8px', marginBottom: 2 }}>
        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: isNight ? '#FFB24A' : 'var(--eira-ocean)' }}>
          {curZone.label}
        </span>
        <span style={{ fontSize: 'var(--font-xs)', color: isNight ? '#BFD9E6' : 'var(--text-2)' }}>
          Casa {current + 1}
        </span>
      </div>

      <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 340 130" style={{ width: '100%', display: 'block' }}>
        {/* paisagem por casa */}
        {slots.map((house, i) => <Scenery key={house} x={xs[i]} zone={zoneOf(house)} />)}

        {/* trilho */}
        <path d={path} stroke={isNight ? '#7FB6D0' : '#fff'} strokeWidth="7" fill="none" strokeLinecap="round" opacity=".9" />
        <path d={path} stroke={curZone.ground} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="1 9" opacity=".7" />

        {/* casas */}
        {slots.map((house, i) => {
          const milestone = MILESTONES.find(m => m.at === house + 1)
          const passed = house < current
          const isCur = house === current
          return (
            <g key={house}>
              {milestone && (
                <g>
                  <line x1={xs[i]} y1={ys[i] - 12} x2={xs[i]} y2={ys[i] - 30} stroke={curZone.ground} strokeWidth="2" />
                  <polygon points={`${xs[i]},${ys[i] - 30} ${xs[i] + 14},${ys[i] - 25} ${xs[i]},${ys[i] - 20}`} fill={house < current ? '#FFB24A' : '#DCE9EF'} />
                </g>
              )}
              <circle
                cx={xs[i]} cy={ys[i]} r={isCur ? 13 : 10}
                fill={passed ? '#FFB24A' : isCur ? '#fff' : isNight ? '#0E2C3C' : '#fff'}
                stroke={isCur ? '#CF7A1E' : passed ? '#CF7A1E' : isNight ? '#7FB6D0' : '#DCE9EF'}
                strokeWidth={isCur ? 3 : 2}
              />
              {passed && (
                <path d={`M ${xs[i] - 4} ${ys[i]} l 3 3.5 l 6 -7`} stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {!passed && !isCur && (
                <text x={xs[i]} y={ys[i] + 3.5} textAnchor="middle" fontSize="9" fontFamily="Poppins, sans-serif" fontWeight="700" fill={isNight ? '#7FB6D0' : '#5B7686'}>
                  {house + 1}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Raposo sobre a casa atual (posicionado relativo ao SVG) */}
      {curIdx >= 0 && (
        <Fox
          size={44}
          mood={foxMood}
          style={{
            position: 'absolute',
            left: `calc(${((xs[curIdx]) / 340) * 100}% - 22px)`,
            top: `calc(${(ys[curIdx] / 130) * 100}% - 52px)`,
            pointerEvents: 'none',
          }}
        />
      )}
      </div>
    </div>
  )
}

/** Grelha de medalhas — conquistadas a cores, futuras a cinzento com cadeado */
export function MedalGrid({ position }: { position: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      {MILESTONES.map(m => {
        const earned = position >= m.at
        return (
          <div key={m.at} className="card" style={{ padding: '12px 10px', textAlign: 'center', opacity: earned ? 1 : .6 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', margin: '0 auto 8px',
              background: earned ? 'var(--warning-lt)' : 'var(--eira-mist)',
              border: `2px solid ${earned ? 'var(--eira-sun)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={earned ? 'star' : 'lock'} size={20} style={{ color: earned ? 'var(--eira-sun)' : 'var(--text-2)' }} fill={earned} />
            </div>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700 }}>{m.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 2 }}>
              {earned ? 'Conquistada!' : `Casa ${m.at}`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
