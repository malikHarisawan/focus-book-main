# App Usage Details Component Guide

## 📍 Location
The "bottom double card" below the area chart in the Dashboard

**Component:** `src/renderer/src/components/Dashboard/AppUsageDetails.jsx`

---

## 🎯 What It Does

Shows a **detailed breakdown** of applications used during a **selected time range** on the productivity chart.

---

## 🔄 How It Works

### 1. **Triggering the Component**
- **User Action:** Click and drag on the area chart to select a time range
- **What Happens:** The chart calls `onSelectionChange()` which passes:
  - `selectedApps` - List of apps used in that period
  - `selectedRange` - Time range selected (startIndex, endIndex)

### 2. **Display Logic**
```javascript
// Component is hidden until you select a range
if (!isVisible || !selectedApps || selectedApps.length === 0) {
  return null  // Nothing shown
}
```

---

## 🎨 Visual Structure

```
┌───────────────────────────────────────────────────────────┐
│ 🕐 App Usage Details    [3 hours selected]   12 apps  [×] │ ← Header
├───────────────────────────────────────────────────────────┤
│ Application       │ Category   │ Time  │ Productive │ ⋮   │ ← Table Header
├───────────────────────────────────────────────────────────┤
│ 🅱️ Brave Browser │ 🌐 Browsing│ 2h 15m│ [Productive]│ ... │ ← Row 1
│ 💻 VS Code       │ 💻 Code    │ 1h 30m│ [Productive]│ ... │ ← Row 2
│ 📱 Slack         │ 💬 Messaging│ 45m   │ [Neutral]   │ ... │ ← Row 3
│ ...              │            │       │             │     │
├───────────────────────────────────────────────────────────┤
│ Total: 4h 30m                Showing 10 of 12 apps        │ ← Footer
└───────────────────────────────────────────────────────────┘
```

---

## 📊 Component Features

### Header Section
- **Clock Icon + Title:** "App Usage Details"
- **Blue Badge:** Shows selected range (e.g., "3 hours selected", "5 days selected")
- **App Count:** Number of apps used (e.g., "12 apps")
- **Show All/Less Button:** Appears if more than 10 apps
- **Close Button (×):** Hides the details panel

### Table Columns

#### 1. **Application** (Sortable)
- App icon (first letter in gradient circle)
- App name
- Domain (if applicable)

#### 2. **Category** (Sortable)
- Emoji icon (🌐 🎮 💻 etc.)
- Category name (Browsing, Code, Entertainment, etc.)

#### 3. **Time Spent** (Sortable)
- Formatted as "2h 15m" or "45m"
- Displayed in brand purple color

#### 4. **Productivity**
- Badge with color:
  - 🟦 **Productive** - Purple badge
  - 🟦 **Neutral** - Cyan badge
  - 🟥 **Distracting** - Red badge

#### 5. **Actions**
- Three-dot menu (⋮)
- Dropdown to **Change Category**
- Lists all available categories with emojis

### Footer Section
- **Total Time:** Sum of all app usage in selected range
- **Count Display:** "Showing 10 of 12 apps"

---

## 🎨 Design Updates Applied

### Before (Old Colors)
- ❌ Slate/Cyan colors (`slate-900`, `cyan-600`)
- ❌ Gray borders (`border-gray-200`)
- ❌ Inconsistent with app design

### After (New Colors)
- ✅ Brand colors (`#5051F9`, `#1EA7FF`, `#FF6B6B`)
- ✅ Design system colors (`#E8EDF1`, `#212329`)
- ✅ Consistent with rest of app

### Spacing Optimizations
| Element | Before | After | Change |
|---------|--------|-------|--------|
| Card margin-top | `mt-4` | `mt-3` | More compact |
| Header padding-bottom | `pb-3` | `pb-2` | Tighter |
| Table header padding | `p-3` | `p-2.5` | Reduced |
| Row padding | `py-3 px-3` | `py-2.5 px-2.5` | More compact |
| Footer padding | `p-3` | `p-2.5` | Consistent |
| Icon size | `w-8 h-8` | `w-7 h-7` | Smaller |

---

## 💡 Usage Example

```jsx
<AppUsageDetails
  selectedApps={[
    { 
      name: 'Brave Browser',
      category: 'Browsing',
      timeSpentSeconds: 8100,  // 2h 15m
      productivity: 'Productive',
      domain: 'youtube.com'
    },
    // ... more apps
  ]}
  selectedRange={{ startIndex: 9, endIndex: 12 }}  // 9AM - 12PM
  zoomLevel="hour"
  isVisible={true}
  onCategoryChange={(appIds, newCategory) => {
    // Handle category change
  }}
  onClose={() => {
    // Hide the panel
  }}
/>
```

---

## 🔧 Sorting Feature

Click on column headers to sort:
- **Name:** Alphabetically (A-Z / Z-A)
- **Category:** Alphabetically (A-Z / Z-A)
- **Time Spent:** By duration (Most/Least)

**Indicator:** Chevron icon (↑ ↓) shows current sort direction

---

## 📱 Responsive Behavior

- **Desktop:** Shows all columns
- **Tablet:** Grid layout adjusts
- **Mobile:** May need horizontal scroll (table is 11 columns wide)

**Scrolling:**
- Max height: `max-h-80` (320px)
- Custom scrollbar styling
- Sticky header (stays visible while scrolling)

---

## 🎯 User Workflows

### Workflow 1: View Time Period Details
1. Go to Dashboard
2. Switch to "Timeline" tab
3. Click and drag on chart to select range
4. **Details card appears below**
5. Review apps used in that period

### Workflow 2: Change App Category
1. Select time range on chart
2. In details card, click ⋮ (three dots) on an app
3. Select "Change Category"
4. Choose new category from submenu
5. Category updates (with emoji icon)

### Workflow 3: Sort Apps
1. Open details card (select range)
2. Click "Application", "Category", or "Time Spent" header
3. Apps re-sort
4. Click again to reverse order

### Workflow 4: View All Apps
1. If more than 10 apps detected
2. Click "Show All" button
3. All apps display (no limit)
4. Click "Show Less" to return to top 10

---

## 🐛 Common Issues & Solutions

### Issue: Card doesn't appear
**Solution:** Make sure you're **dragging** on the chart, not just clicking

### Issue: Wrong apps shown
**Solution:** Check `selectedDate` matches the chart date

### Issue: Can't change category
**Solution:** Ensure `onCategoryChange` prop is provided

---

## 🎨 Color Reference

```javascript
// Brand Colors
Primary Purple: #5051F9
Secondary Cyan: #1EA7FF
Tertiary Red: #FF6B6B

// Background
Light Card: #FFFFFF
Dark Card: #212329
Light BG: #F4F7FE
Dark BG: #1E1F25

// Borders
Light: #E8EDF1
Dark: #282932

// Text
Primary Light: #232360
Primary Dark: #FFFFFF
Secondary: #768396 / #898999
```

---

## 📝 Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectedApps` | Array | `[]` | List of apps with usage data |
| `selectedRange` | Object | `null` | Time range (startIndex, endIndex) |
| `zoomLevel` | String | `'hour'` | Chart zoom level (hour/day/week/month) |
| `isVisible` | Boolean | `true` | Show/hide the component |
| `onCategoryChange` | Function | `() => {}` | Callback when category changes |
| `onClose` | Function | `() => {}` | Callback when close button clicked |

---

## 🔮 Future Enhancements

Potential improvements:
- [ ] Export to CSV
- [ ] Filter by productivity type
- [ ] Inline edit app name
- [ ] Bulk category change
- [ ] Visual time breakdown chart
- [ ] Compare to average usage

---

**Last Updated:** December 15, 2025
**Component Path:** `src/renderer/src/components/Dashboard/AppUsageDetails.jsx`
