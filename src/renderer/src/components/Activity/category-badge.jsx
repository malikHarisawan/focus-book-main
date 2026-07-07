import { Badge } from '../ui/badge'
import { CategoryIcon, getCategoryColor } from '../../utils/categoryVisuals'

// Category badge is fully DB-driven: the icon comes from the category's `icon`
// column (via CategoryIcon) and the accent color from its `color` column. This
// replaces the old hardcoded per-category switch statements.
export default function CategoryBadge({ category }) {
  const color = getCategoryColor(category)

  return (
    <Badge
      variant="outline"
      className="text-xs flex items-center"
      style={{
        color,
        borderColor: `${color}4D`, // ~30% alpha
        backgroundColor: `${color}1A` // ~10% alpha
      }}
    >
      <CategoryIcon category={category} />
      {category}
    </Badge>
  )
}
