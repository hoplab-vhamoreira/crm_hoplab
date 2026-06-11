import { Icon } from './Icon'

/**
 * Chamada de vídeo embebida (Jitsi Meet via iframe).
 * Abre em overlay de ecrã completo dentro da app — sem sair para outra janela.
 */
export function VideoCall({ url, onClose }: { url: string; onClose: () => void }) {
  // Acrescenta config para esconder elementos desnecessários do Jitsi
  const src = url.includes('#') ? url : `${url}#config.prejoinConfig.enabled=true&config.disableDeepLinking=true`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--eira-night)', display: 'flex', flexDirection: 'column' }}>
      {/* Barra superior */}
      <div style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--eira-paper)', fontWeight: 600, fontSize: 'var(--font-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="video" size={16} style={{ color: 'var(--eira-ocean-lt)' }} /> Consulta online
        </span>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--eira-paper)', padding: '8px 14px', fontFamily: 'Poppins, sans-serif',
            fontSize: 'var(--font-sm)', fontWeight: 600,
          }}
        >
          <Icon name="close" size={15} /> Sair da consulta
        </button>
      </div>

      {/* Chamada */}
      <iframe
        src={src}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        style={{ flex: 1, width: '100%', border: 'none' }}
        title="Consulta online"
      />
    </div>
  )
}
