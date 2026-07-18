import type { Card, Rarity } from '@/lib/types'
import { Sheet } from '@/ui/Sheet'
import { Naipe } from './Naipe'
import { ageFrom } from './card-data'

const RARITY_LABEL: Record<Rarity, string> = {
  comun: 'Común',
  frecuente: 'Frecuente',
  rara: 'Rara',
}

const POSITION_LABEL: Record<string, string> = {
  GK: 'Portero',
  DF: 'Defensa',
  MF: 'Medio',
  FW: 'Delantero',
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="font-display text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  )
}

/**
 * The card, held up close. This is the only place the naipe prints its factor
 * labels in full, and the only place the richer columns on `cards` — nationality,
 * age — are surfaced at all.
 */
export function CardSheet({
  card,
  onClose,
  action,
}: {
  card: Card | null
  onClose: () => void
  /** Optional footer control, e.g. add-to-squad from the picker. */
  action?: React.ReactNode
}) {
  if (!card) return null
  const age = ageFrom(card.birth_date)
  const position = card.position ? (POSITION_LABEL[card.position] ?? card.position) : null

  return (
    <Sheet open onClose={onClose} title={card.name}>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <div className="mx-auto w-full max-w-[260px] shrink-0">
          <Naipe card={card} variant="full" />
        </div>

        <dl className="grid grid-cols-3 gap-3 border-y border-white/10 py-3">
          {position && <Fact label="Puesto" value={position} />}
          <Fact label="Ficha" value={`${card.cost} pts`} />
          <Fact label="Rareza" value={RARITY_LABEL[card.rarity]} />
          {card.club && <Fact label="Club" value={card.club} />}
          {card.nationality && (
            <Fact label="Nacionalidad" value={card.nationality} />
          )}
          {age !== null && <Fact label="Edad" value={`${age} años`} />}
        </dl>

        <p className="text-xs leading-relaxed text-slate-500">
          La demarcación (en rojo) es del juego avanzado: el juego básico se juega «sin
          demarcación», así que no afecta a los partidos de hoy.
        </p>

        {action}
      </div>
    </Sheet>
  )
}
