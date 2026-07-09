import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Inicio', icon: '⚽', end: true },
  { to: '/squad', label: 'Equipo', icon: '👕', end: false },
  { to: '/collection', label: 'Colección', icon: '🗂️', end: false },
  { to: '/store', label: 'Tienda', icon: '🛒', end: false },
]

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-white/5 bg-pitch-950/90 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  isActive ? 'text-grass-400' : 'text-slate-400'
                }`
              }
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
