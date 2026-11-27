import { FACTORY_PITCH } from '../lib/brand'

type FactoryPitchProps = {
  tone?: 'light' | 'dark'
}

/** Frase de efeito da fábrica (§5): 2 linhas fixas · linha 2 em negrito dourado #8A6A2F no Papel. */
export function FactoryPitch({ tone = 'light' }: FactoryPitchProps) {
  return (
    <p className={`factory-pitch factory-pitch--${tone}`}>
      <strong>
        {FACTORY_PITCH.name} - {FACTORY_PITCH.tagline}
      </strong>
      <strong className="factory-pitch-line2">
        {FACTORY_PITCH.line1} {FACTORY_PITCH.line2}
      </strong>
    </p>
  )
}
