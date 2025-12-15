# Quick Spacing Reference Card

Print this out or keep it handy while coding! 📏

---

## The 8px Grid System

```
┌─────────────────────────────────────────────┐
│  Tailwind Class  │  Pixels  │  Use For      │
├─────────────────────────────────────────────┤
│  0               │  0px     │  None         │
│  0.5             │  2px     │  Hairline     │
│  1               │  4px     │  Tight        │
│  1.5             │  6px     │  Icon gaps    │
│  2               │  8px     │  Base unit    │
│  2.5             │  10px    │  Bars         │
│  3               │  12px    │  Comfortable  │
│  4               │  16px    │  Standard     │
│  6               │  24px    │  Sections     │
│  8               │  32px    │  Large gaps   │
│  12              │  48px    │  Major breaks │
└─────────────────────────────────────────────┘
```

---

## Component Patterns

### 🎴 Cards
```jsx
<Card>
  <CardHeader className="p-4">        // 16px padding
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent className="p-4 pt-0">  // 16px, no top
    {/* content */}
  </CardContent>
</Card>
```

### 🔘 Buttons
```jsx
<Button size="sm" />      // h-8  (32px)
<Button size="default" /> // h-9  (36px) ← Most common
<Button size="lg" />      // h-10 (40px)
<Button size="icon" />    // h-9 w-9
```

### 📐 Gaps Between Elements
```jsx
<div className="gap-1.5">  // 6px  - Icon + text
<div className="gap-2">    // 8px  - Button groups
<div className="gap-3">    // 12px - Form fields
<div className="gap-4">    // 16px - Card sections
```

### 📊 Vertical Spacing
```jsx
<div className="space-y-2">  // 8px  - List items
<div className="space-y-3">  // 12px - Form fields
<div className="space-y-4">  // 16px - Sections
```

### 📏 Padding & Margins
```jsx
className="p-3"   // 12px - Compact UI, sidebars
className="p-4"   // 16px - Standard cards
className="mb-2"  // 8px  - Small breaks
className="mb-3"  // 12px - Section breaks
className="mb-4"  // 16px - Major sections
```

---

## Common Combinations

### Navigation Item
```jsx
<button className="px-2.5 py-2 gap-2 rounded-lg">
  <Icon className="h-4 w-4" />
  <span>Label</span>
</button>
```

### Stat Card
```jsx
<div className="p-3 space-y-2">
  <div className="text-sm">Label</div>
  <div className="text-lg">Value</div>
</div>
```

### Icon + Text
```jsx
<div className="flex items-center gap-2">
  <Icon className="h-5 w-5" />
  <span>Text</span>
</div>
```

### Form Field
```jsx
<div className="space-y-3">
  <input className="px-3 py-2" />
  <input className="px-3 py-2" />
</div>
```

---

## Font Sizes

```
text-xs   → 12px - Labels, badges
text-sm   → 14px - Body text, descriptions
text-base → 16px - Standard text
text-lg   → 18px - Card titles
text-xl   → 20px - Section headers
text-2xl  → 24px - Page headers
```

---

## Icon Sizes

```
h-4 w-4  → 16px - Small icons, inline
h-5 w-5  → 20px - Standard icons
h-6 w-6  → 24px - Large icons, headers
```

---

## Border Radius

```
rounded-lg  → 8px  - Standard (buttons, cards)
rounded-xl  → 12px - Large cards
rounded-2xl → 16px - Hero cards
```

---

## DO's and DON'Ts

### ✅ DO
- Use multiples of 4px (0.5, 1, 1.5, 2, 3, 4, 6, 8...)
- Keep related items close (gap-2)
- Give sections breathing room (gap-4, mb-4)
- Use consistent spacing for similar patterns

### ❌ DON'T
- Use random values (gap-5, p-7, mb-9)
- Over-space everything
- Mix different gaps for the same pattern
- Forget to test on mobile

---

## Mobile Considerations

```jsx
// ✅ Good - Simple, works everywhere
className="p-3"

// ❌ Avoid - Complex breakpoints
className="p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6"
```

Keep it simple! One value that works for all screens is better than 5 breakpoints.

---

## Real Examples from Our App

### Dashboard Header
```jsx
<CardHeader className="py-3 px-4">
  <div className="flex items-center gap-3">
    <CardTitle className="flex items-center">
      <Activity className="mr-2 h-5 w-5" />
      <span>Productivity Overview</span>
    </CardTitle>
  </div>
</CardHeader>
```

### Sidebar Nav
```jsx
<nav className="space-y-0.5">
  <button className="px-2.5 py-2 gap-2 rounded-lg">
    <Icon className="h-4 w-4" />
    <span>Dashboard</span>
  </button>
</nav>
```

### Chat Messages
```jsx
<div className="p-3 space-y-3">
  <div className="flex gap-2">
    <Avatar className="w-7 h-7" />
    <div className="px-3 py-2">Message</div>
  </div>
</div>
```

---

## When in Doubt...

**Ask yourself:**
1. Are these items related? → Use **gap-2** (8px)
2. Are these different sections? → Use **gap-4** (16px)
3. Is this a card? → Use **p-4** (16px)
4. Is this a button? → Use **h-9** (36px)

---

**Remember:** Consistency > Perfection

It's better to consistently use gap-3 everywhere than to perfectly calculate each gap!

---

**Updated:** December 15, 2025
**Next Review:** When adding major new features
