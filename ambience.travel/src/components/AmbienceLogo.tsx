import type { CSSProperties } from 'react'

interface AmbienceLogoProps {
  isDark: boolean
  product?: 'sports' | 'travel' | 'life'
  height?: number | string
  opacity?: number
  style?: CSSProperties
}

const PRODUCT_STYLES = {
  sports: {
    ariaLabel: 'ambience.SPORTS',
    suffix: '.sports',
    suffixColor: '#b5a06e',
    suffixLetterSpacing: '0.05em',
  },
  travel: {
    ariaLabel: 'ambience.TRAVEL',
    suffix: '.travel',
    suffixColor: '#C9B88E',
    suffixLetterSpacing: '0.03em',
  },
  life: {
    ariaLabel: 'ambience.LIFE',
    suffix: '.life',
    suffixColor: '#8FA08F',
    suffixLetterSpacing: '0.04em',
  },
} as const

export default function AmbienceLogo({
  isDark,
  product = 'travel',
  height = 88,
  opacity,
  style,
}: AmbienceLogoProps) {
  const ambienceColor = isDark ? '#FAF8F6' : '#1A1D1A'
  const config = PRODUCT_STYLES[product]

  const isNumeric = typeof height === 'number'
  const totalH = isNumeric ? `${height}px` : height
  const sizeA = isNumeric
    ? `${Math.round((height as number) * 0.60)}px`
    : `calc(${height} * 0.60)`
  const sizeS = isNumeric
    ? `${Math.round((height as number) * 0.28)}px`
    : `calc(${height} * 0.28)`

  return (
    <div
      aria-label={config.ariaLabel}
      role='img'
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: totalH,
        width: 'fit-content',
        flexShrink: 0,
        overflow: 'hidden',
        opacity,
        lineHeight: 1,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: "'Canela Text', 'Canela', 'Playfair Display', Georgia, serif",
          fontSize: sizeA,
          fontWeight: 300,
          color: ambienceColor,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        ambience
      </div>

      <div
        style={{
          fontFamily: "'Canela Text', 'Canela', 'Playfair Display', Georgia, serif",
          fontSize: sizeS,
          fontWeight: 400,
          color: config.suffixColor,
          letterSpacing: config.suffixLetterSpacing,
          whiteSpace: 'nowrap',
        }}
      >
        {config.suffix}
      </div>
    </div>
  )
}