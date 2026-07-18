import type { ReactNode } from 'react'
import type { AbilityKey } from '@/lib/types'
import { ABILITY_META } from '@/game/abilities'
import { Sheet } from '@/ui/Sheet'

/**
 * A concise, Spanish-only primer on the Juego Básico, openable from the rival picker and
 * mid-match. The content is a plain-language digest of docs/rulebook (pages 1–13) plus the
 * shipped 15-turno tournament clock (docs/rulebook/DEVIATIONS.md, page 29) — the rules a
 * newcomer needs to make sense of the board, not a full transcription.
 *
 * The habilidades legend doubles as the key for the ability chips the match panel prints on
 * each action button, so a player who reads it here understands «RM 3» in play.
 */

/**
 * The ratings that actually resolve a jugada in the basic game. The name comes from
 * `ABILITY_META`; `note` only adds the context the label alone doesn't carry (which side of
 * the ball, near vs far), so it reads «RM — Remate (en el área)», never «RG — Regate (regate)».
 */
const ABILITY_GUIDE: { key: AbilityKey; note?: string }[] = [
  { key: 'pc' },
  { key: 'pl' },
  { key: 'rg' },
  { key: 'rm', note: 'en el área' },
  { key: 'dl' },
  { key: 'a', note: 'en defensa' },
  { key: 'rb', note: 'en defensa' },
  { key: 'rf', note: 'parada del portero de cerca' },
  { key: 'co', note: 'parada del portero de lejos' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-200">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-slate-300">{children}</p>
    </section>
  )
}

export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Cómo se juega" size="wide">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
        <Section title="Objetivo">
          Marca más goles que tu rival en 15 turnos. Cada vez que el balón pasa de un equipo
          al otro cuenta como un turno; al llegar a 15 gana quien tenga más goles. Se admite
          el empate.
        </Section>

        <Section title="El tablero">
          Se juega en una cuadrícula de 5×6 casillas más las dos porterías, y atacas hacia
          arriba. Las casillas pegadas a la portería rival son la zona de remate (RM); un poco
          más atrás está la de disparo lejano (DL).
        </Section>

        <Section title="Tu turno">
          Con el balón puedes dar un pase (directo, corto, largo o al hueco), regatear, rematar
          o disparar de lejos, o mover a un jugador. Mientras conserves el balón, sigues siendo
          tú quien juega.
        </Section>

        <Section title="Los dados">
          Casi toda acción se decide con dados y necesita sumar 10 o más. Sin marca (o marcado
          en zona): 1 dado + 5 + tu habilidad. Marcado al hombre: 2 dados + tu habilidad. El
          pase directo a un compañero de al lado es automático, sin dados.
        </Section>

        <Section title="El marcaje">
          Un rival te marca colocándose en tu casilla. Si queda encima de tu ficha, te marca al
          hombre (lo tienes más difícil); si queda debajo, es marca en zona. Solo en la casilla,
          juegas libre. Se ve en cómo se apilan las fichas en el tablero.
        </Section>

        <Section title="Gol y portero">
          Si tu remate o disparo supera la tirada, el portero intenta pararlo: con RF en el área
          y con CO desde lejos. Para con 10, 11 o 12; en caso contrario, es gol.
        </Section>

        <section className="flex flex-col gap-2">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-200">
            Las habilidades
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">
            Cada acción usa una habilidad de la carta; cuanto más alta, más fácil te resulta.
            Durante el partido, cada botón muestra la habilidad que decide esa jugada.
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 md:grid-cols-2">
            {ABILITY_GUIDE.map(({ key, note }) => (
              <div key={key} className="flex items-baseline gap-2 text-sm">
                <dt className="w-8 shrink-0 font-bold tabular-nums text-slate-100">
                  {ABILITY_META[key].abbr}
                </dt>
                <dd className="text-slate-300">
                  {ABILITY_META[key].label}
                  {note && <span className="text-slate-400"> ({note})</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Sheet>
  )
}
