import type { ComponentType, SVGProps } from 'react'
import {
  HomeIcon,
  UserGroupIcon,
  RectangleStackIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'

export interface NavTab {
  to: string
  label: string
  /** A heroicons SVG component, rendered by each chrome at its own size. */
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Exact-match the route — only `/` needs it, or it lights up everywhere. */
  end: boolean
}

/**
 * The primary destinations. Rendered as the BottomNav below md and as inline
 * tabs in the TopBar above it — one array, two chromes, never two lists that
 * drift. Data only (no JSX) so neither chrome has to import the other.
 *
 * `/play` is deliberately absent: it is an action, not a destination, and it is
 * gated on having 11 titulares. Home's CTA owns that gating; a permanently
 * enabled tab would route people to a screen they cannot use. `/admin` is
 * likewise absent — it is the conditional gear in the TopBar's right cluster,
 * not a player destination.
 */
export const TABS: NavTab[] = [
  { to: '/', label: 'Inicio', icon: HomeIcon, end: true },
  { to: '/squad', label: 'Equipo', icon: UserGroupIcon, end: false },
  { to: '/collection', label: 'Colección', icon: RectangleStackIcon, end: false },
  { to: '/store', label: 'Tienda', icon: ShoppingCartIcon, end: false },
]
