import {
  Globe,
  Code as CodeIcon,
  FileText,
  Video,
  BookOpen,
  MessageSquare,
  Package,
  User,
  Briefcase,
  Terminal,
  Wrench,
  Users
} from 'lucide-react'
import { getCategoryColorFromDB, getCategoryIconFromDB } from './dataProcessor'

// Central place that turns a DB-stored icon name (categories.icon, a lucide-react
// icon name string) into an actual component. Every component that renders a
// category icon should resolve through here so there is one icon vocabulary, not
// a hardcoded switch per component.
const ICON_COMPONENTS = {
  Globe,
  Code: CodeIcon,
  CodeIcon,
  FileText,
  Video,
  BookOpen,
  MessageSquare,
  Package,
  User,
  Briefcase,
  Terminal,
  Wrench,
  Users
}

// Resolve a category to its icon component (DB-driven, with a Package fallback).
export function getCategoryIconComponent(category) {
  const iconName = getCategoryIconFromDB(category)
  return ICON_COMPONENTS[iconName] || Package
}

// Render a category's icon element with sensible defaults; pass className to size.
export function CategoryIcon({ category, className = 'h-3.5 w-3.5 mr-1' }) {
  const Icon = getCategoryIconComponent(category)
  return <Icon className={className} />
}

// Re-export the DB color helper so consumers have one import for category visuals.
export { getCategoryColorFromDB as getCategoryColor }
