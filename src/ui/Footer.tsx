/**
 * Homage/attribution line. Super Gol is a fan recreation of the 1995 Fournier
 * card game; this footer makes the tribute explicit and states plainly that the
 * project is unofficial and unaffiliated — the disclaimer half of paying homage.
 * Full-bleed border like the bars, inner row on the width token.
 */
export function Footer() {
  return (
    <footer className="border-t border-white/5 text-slate-500">
      <div className="app-wide px-4 py-6 text-center text-xs leading-relaxed md:px-6">
        Un homenaje al juego de cartas{' '}
        <span className="font-semibold text-slate-400">Super Gol</span>{' '}
        (Naipes Heraclio Fournier, 1995). Proyecto no oficial, sin ánimo de lucro
        y sin relación con Marca ni Fournier.
      </div>
    </footer>
  )
}
