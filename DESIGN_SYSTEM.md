# FocusBook Design System

## Visual Design Foundation

### Color System

**Primary Palette: "Focus Purple"**
- **Primary Brand:** Purple spectrum (focus, creativity, modern productivity)
  - `primary`: #5051F9 (main brand color—buttons, links, focus states, productive time indicators)
  - `primary-hover`: #4142E0 (hover states)
  - `primary-light`: #6B6CFA (active dots, lighter accents)
- **Rationale:** Purple conveys focus and creativity—perfect for a productivity tracking tool. Creates a distinctive, modern identity that stands out from typical blue productivity apps.

**Secondary/Accent: "Insight Cyan"**
- **Secondary Accent:** Cyan spectrum (clarity, data visualization, secondary actions)
  - `secondary`: #1EA7FF (secondary buttons, links, neutral time indicators)
  - `secondary-light`: #4BBAFF (hover states, highlights)
- **Rationale:** Cyan provides visual contrast for secondary actions and data visualization while maintaining a cohesive, modern aesthetic.

**Alert/Status: "Attention Salmon"**
- **Distracting/Unproductive:** Salmon/Red spectrum (attention, warnings)
  - `distracting`: #FF6B6B (unproductive time, distracting apps, warnings)
  - `distracting-hover`: #E65C5C (hover states)
- **Rationale:** Red/salmon immediately draws attention to unproductive patterns without being aggressive, encouraging self-awareness.

**Neutral Palette: "Clean Foundation"**

*Light Mode:*
| Token | Hex | Usage |
|-------|-----|-------|
| `background` | #FFFFFF | Card backgrounds, main surfaces |
| `background-secondary` | #F4F7FE | Page background, secondary surfaces |
| `border` | #E8EDF1 | Borders, dividers |
| `text-primary` | #232360 | Headings, primary text |
| `text-secondary` | #768396 | Body text, labels |

*Dark Mode:*
| Token | Hex | Usage |
|-------|-----|-------|
| `background` | #1E1F25 | Page background |
| `background-card` | #212329 | Card backgrounds, elevated surfaces |
| `background-input` | #282932 | Input fields, borders |
| `text-primary` | #FFFFFF | Headings, primary text |
| `text-secondary` | #898999 | Body text, labels |
| `text-tertiary` | #768396 | Muted text, placeholders |

- **Rationale:** High contrast for readability with a soothing, modern feel. Dark mode uses subtle elevation through background color variation rather than heavy shadows.

**Semantic Colors:**
| Purpose | Hex | Usage |
|---------|-----|-------|
| Success | #22C55E | Focus sessions completed, goals achieved |
| Warning | #F59E0B | Approaching limits, medium alerts |
| Error | #FF6B6B | Distracting time, blocked apps, critical alerts |
| Info | #1EA7FF | Tips, insights, neutral information |

**Accessibility:**
- All text/background combinations meet WCAG AA contrast (4.5:1 minimum)
- Interactive elements meet AAA (7:1) where possible
- Color never used as sole indicator (icons + text accompany color coding)

---

### Typography System

**Font Pairing: Modern + Soothing**

**Primary Font: DM Sans (sans-serif)**
- Clean, geometric sans-serif with friendly, rounded terminals
- Excellent readability at all sizes
- Modern, approachable feel—less clinical than Inter
- Supports all weights (400–700)
- Used for both headings and body text for visual cohesion

**Fallback: Inter (sans-serif)**
- Secondary fallback maintains similar geometric feel
- Ensures consistent experience across systems

**Monospace (code/data): JetBrains Mono**
- For time displays, statistics, technical content
- Clear distinction from prose

**Type Scale:**
| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| h1 | 2.25rem (36px) | 700 | Page titles, hero text |
| h2 | 1.875rem (30px) | 600 | Section headers |
| h3 | 1.5rem (24px) | 600 | Subsections, card titles |
| h4 | 1.25rem (20px) | 600 | Widget headers |
| body | 1rem (16px) | 400 | Primary content |
| small | 0.875rem (14px) | 400 | Secondary text, labels |
| tiny | 0.75rem (12px) | 500 | Metadata, timestamps |

**Line Heights:**
- Headings: 1.2 (tight, impactful)
- Body: 1.6 (comfortable reading)
- UI elements: 1.4 (compact but clear)

**Rationale:** DM Sans provides a friendlier, more approachable feel than typical productivity apps while maintaining professionalism. The rounded terminals reduce visual tension—appropriate for a tool designed to reduce stress around productivity.

---

### Spacing & Layout Foundation

**Spacing Scale: 8px Base Unit**
| Token | Size | Usage |
|-------|------|-------|
| xs | 4px (0.25rem) | Icon padding, tight spacing |
| sm | 8px (0.5rem) | Between related elements |
| md | 16px (1rem) | Default spacing |
| lg | 24px (1.5rem) | Between sections |
| xl | 32px (2rem) | Major section breaks |
| 2xl | 48px (3rem) | Page-level spacing |
| 3xl | 64px (4rem) | Hero sections |

**Layout Principles:**

1. **Soothing, Not Overwhelming**
   - Generous whitespace between elements (reduces anxiety)
   - Breathing room around productivity data
   - Soft, subtle shadows and borders
   - Gentle gradients (primary-to-secondary) for visual interest

2. **Content-First Grid**
   - Main content: 60-70% width on large screens
   - Sidebar navigation: 240px fixed with icon + label design
   - Right panel (AI chat): 320px collapsible
   - Responsive breakpoints: 640px, 768px, 1024px, 1280px

3. **Card-Based Components**
   - Cards: 8px–12px border-radius (modern, friendly)
   - Buttons: 6px–8px border-radius
   - Input fields: 8px border-radius
   - Subtle shadows with low opacity for depth

4. **Consistent Padding**
   - Buttons: 12px vertical, 16px horizontal
   - Cards: 16px–24px internal padding
   - Page margins: 16px mobile, 24px–32px desktop

**Layout Strategy:**
- **Dashboard:** Card-grid layout with productivity overview, charts, AI insights
- **Charts:** Full-width area charts with primary/distracting color coding
- **AI Chat:** Fixed side panel with conversational interface
- **Settings:** Clean two-column form layout with toggle switches

---

### Accessibility Considerations

**Color Contrast:**
- Text meets WCAG AA minimum (4.5:1 for body, 3:1 for large text)
- Interactive elements use focus indicators (2px outline, primary #5051F9)
- Dark mode carefully calibrated for comfortable extended viewing

**Typography:**
- Minimum 16px body text (no smaller than 14px for secondary)
- Line-height 1.6 for readability
- No all-caps text blocks (harder to scan)

**Keyboard Navigation:**
- All interactive elements reachable via Tab
- Focus rings visible on all interactive elements
- Skip-to-content links for screen readers

**Motion & Animation:**
- Respect `prefers-reduced-motion` media query
- Essential animations only (loading states, transitions)
- Smooth transitions (200-300ms duration)
- Subtle hover effects for feedback

**Screen Reader Support:**
- Semantic HTML (nav, main, aside, section)
- ARIA labels on icon-only buttons
- Live regions for AI chat responses
- Descriptive alt text for charts and visualizations

---

### Quick Reference

**Core Colors:**
```
Primary:     #5051F9
Secondary:   #1EA7FF
Distracting: #FF6B6B
```

**Light Mode Backgrounds:**
```
Cards:       #FFFFFF
Page:        #F4F7FE
Borders:     #E8EDF1
```

**Dark Mode Backgrounds:**
```
Page:        #1E1F25
Cards:       #212329
Inputs:      #282932
```

**Fonts:**
```
Primary:   'DM Sans', sans-serif
Fallback:  'Inter', sans-serif
Monospace: 'JetBrains Mono', monospace
```
