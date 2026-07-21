import type { ReactNode } from 'react'
import {
  RectangleStackIcon,
  UserGroupIcon,
  TrophyIcon,
  GiftIcon,
} from '@heroicons/react/24/outline'
import { Naipe } from '@/ui/naipe/Naipe'
import { Coin } from '@/ui/Coin'
import { Footer } from '@/ui/Footer'
import { useShowcaseCards } from '@/screens/landing/useShowcaseCards'
import { WaitlistForm } from '@/screens/landing/WaitlistForm'

/**
 * The public marketing page — the first thing an unauthenticated visitor sees,
 * with the auth form one tap away (`onStart` / `onSignIn`). It renders static
 * Spanish copy, a decorative fan of `Naipe` cards, and the shared homage `Footer`.
 * The fan is the one bit of live data: `useShowcaseCards` fetches a rotating trio
 * from the catalog (cached, degrading to the static `SAMPLE_CARDS` fallback). All
 * product copy is Spanish and the layout uses the single `md` breakpoint (no `sm:`),
 * per the project rules.
 */

interface Step {
  icon: ReactNode
  title: string
  text: string
  /** The coin step reads in gold (`text-rare`); the rest in grass. */
  accent?: 'coin'
}

const STEPS: Step[] = [
  {
    icon: <RectangleStackIcon className="h-6 w-6" aria-hidden />,
    title: 'Colecciona',
    text: 'Reúne las cartas de tus jugadores favoritos de LaLiga.',
  },
  {
    icon: <UserGroupIcon className="h-6 w-6" aria-hidden />,
    title: 'Ficha',
    text: 'Alinea tu once titular y arma el mejor equipo.',
  },
  {
    icon: <TrophyIcon className="h-6 w-6" aria-hidden />,
    title: 'Compite',
    text: 'Juega partidos por turnos contra la máquina.',
  },
  {
    icon: <Coin className="text-2xl" />,
    title: 'Gana monedas',
    text: 'Cada victoria llena tu hucha de monedas.',
    accent: 'coin',
  },
  {
    icon: <GiftIcon className="h-6 w-6" aria-hidden />,
    title: 'Abre sobres',
    text: 'Gasta las monedas en sobres y mejora tu plantilla.',
  },
]

export function Landing({
  onStart,
  onSignIn,
  waitlistEnabled,
}: {
  onStart: () => void
  onSignIn: () => void
  /** Pre-launch mode: swap the signup CTA for the waitlist email capture. Read
   *  from the app_settings flag in AuthProvider (0021). */
  waitlistEnabled: boolean
}) {
  const showcase = useShowcaseCards()
  return (
    <div className="flex min-h-screen flex-col bg-pitch-900">
      {/* Hero */}
      <header className="app-measure flex flex-col items-center px-6 pt-16 pb-12 text-center md:pt-24">
        <h1 className="font-display text-6xl font-extrabold uppercase leading-none tracking-tight text-grass-400 md:text-7xl">
          Super Gol
        </h1>
        <p className="mt-3 font-display text-xl uppercase tracking-wide text-slate-300">
          Colecciona. Ficha. Compite.
        </p>
        <p className="mt-4 max-w-md text-slate-400">
          {waitlistEnabled
            ? 'El mítico juego de cartas de fútbol, ahora en tu móvil. Estamos afinando los últimos detalles: únete a la lista de espera y sé de los primeros en jugar.'
            : 'El mítico juego de cartas de fútbol, ahora en tu móvil. Reúne tu colección, alinea tu once y compite partido a partido.'}
        </p>

        {/* Decorative fan of sample cards */}
        <div className="mt-10 flex items-end justify-center" aria-hidden>
          <div className="w-24 -mr-5 -rotate-[8deg] translate-y-2 md:-mr-8 md:w-40">
            <Naipe card={showcase[0]} />
          </div>
          <div className="z-10 w-28 -translate-y-1 md:w-48">
            <Naipe card={showcase[1]} />
          </div>
          <div className="w-24 -ml-5 rotate-[8deg] translate-y-2 md:-ml-8 md:w-40">
            <Naipe card={showcase[2]} />
          </div>
        </div>

        {waitlistEnabled ? (
          <div className="mt-12 flex w-full flex-col items-center gap-4">
            <WaitlistForm />
            <button
              onClick={onSignIn}
              className="text-sm text-slate-400 md:hover:text-slate-200"
            >
              Ya tengo cuenta
            </button>
          </div>
        ) : (
          <div className="mt-12 flex w-full flex-col gap-3 md:w-auto md:flex-row md:justify-center">
            <button onClick={onStart} className="btn-primary md:px-8">
              Empezar a jugar
            </button>
            <button onClick={onSignIn} className="btn-ghost md:px-8">
              Ya tengo cuenta
            </button>
          </div>
        )}
      </header>

      {/* Cómo funciona */}
      <section className="app-wide px-6 py-8">
        <h2 className="mb-6 text-center font-display text-2xl font-bold uppercase tracking-wide text-slate-100">
          Cómo funciona
        </h2>
        <ol className="grid gap-3 md:grid-cols-5">
          {STEPS.map((step) => (
            <li key={step.title} className="card-surface flex gap-4 p-4 md:flex-col md:gap-3">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  step.accent === 'coin'
                    ? 'bg-rare/15 text-rare'
                    : 'bg-grass-500/15 text-grass-400'
                }`}
              >
                {step.icon}
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-slate-100">
                  {step.title}
                </h3>
                <p className="mt-0.5 text-sm text-slate-400">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex justify-center">
          {waitlistEnabled ? (
            <WaitlistForm />
          ) : (
            <button onClick={onStart} className="btn-primary px-8">
              Empezar a jugar
            </button>
          )}
        </div>
      </section>

      <div className="flex-1" />
      <Footer />
    </div>
  )
}
