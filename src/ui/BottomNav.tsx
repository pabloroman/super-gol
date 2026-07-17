import { NavLink } from 'react-router-dom'
import { TABS } from '@/ui/nav'

/**
 * The phone's tab bar. Above md the TopBar renders the same TABS inline and this
 * hides itself, so exactly one nav is present at any width — display:none keeps
 * the hidden one out of the a11y tree too, not just out of sight.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Principal"
      className="sticky bottom-0 z-20 border-t border-white/5 bg-pitch-950/90 backdrop-blur md:hidden"
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
