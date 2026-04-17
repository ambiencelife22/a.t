export function ImmerseHeroBlock({
  imageSrc,
  imageAlt,
  title,
  subtitle,
}: {
  imageSrc: string
  imageAlt?: string
  title?: string
  subtitle?: string
}) {
  return (
    <section
      style={{
        width: '100%',
        height: 'clamp(420px, 70vh, 720px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Image */}
      <img
        src={imageSrc}
        alt={imageAlt || ''}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />

      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* Content */}
      {(title || subtitle) && (
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            color: '#F5F2EC',
            maxWidth: 800,
            padding: '0 20px',
          }}
        >
          {title && (
            <div
              style={{
                fontSize: 'clamp(32px, 5vw, 64px)',
                fontFamily:
                  '"Cormorant Garamond", "Times New Roman", serif',
                letterSpacing: '-0.02em',
                marginBottom: 12,
              }}
            >
              {title}
            </div>
          )}

          {subtitle && (
            <div
              style={{
                fontSize: 14,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.8,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
    </section>
  )
}