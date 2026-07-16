// src/renderer/src/components/Dashboard/DayTimeline.jsx
import { useMemo, useState } from "react";

// src/renderer/src/utils/dataProcessor.js
var categoryProductivityMap = {};
var categoryColorMap = {};
var categoryIconMap = {};
var categoryList = [];
var categoryModeMap = {};
var modeRollupMap = {};
var modeColorMap = {};
var modeIconMap = {};
var modeList = [];
var DEFAULT_CATEGORY_COLOR = "#7a7a7a";
var DEFAULT_MODE = "Break";
var FALLBACK_CATEGORY_MODE = {
  // Legacy category names (kept for any pre-cutover data).
  Code: "Deep work",
  Browsing: "Deep work",
  Communication: "Collaboration",
  Utilities: "Break",
  Entertainment: "Distraction",
  "Social Media": "Distraction",
  Miscellaneous: "Break",
  // SPAN-MODEL taxonomy (the categories seeded in schema.sql). Maps each resolved
  // category to a work-mode so the Focus-balance donut groups correctly under the
  // new engine (the legacy categories table doesn't know these names).
  Coding: "Deep work",
  Social: "Distraction",
  Uncategorized: "Break"
};
var SPAN_CATEGORY_COLORS = {
  Coding: "#00d8ff",
  Communication: "#a855f7",
  Browsing: "#b381c9",
  Utilities: "#36a2eb",
  Entertainment: "#ff6384",
  Social: "#f97316",
  Uncategorized: "#7a7a7a"
};
async function loadCategoryProductivityMapping() {
  try {
    let cats = [];
    if (window.activeWindow?.spanGetCategories) {
      cats = await window.activeWindow.spanGetCategories();
    }
    if (Array.isArray(cats) && cats.length > 0) {
      const pMap = {};
      const cMap = {};
      cats.forEach((c) => {
        if (!c || !c.name) return;
        const p = c.default_productivity;
        if (p === "productive") pMap[c.name] = "productive";
        else if (p === "distracting") pMap[c.name] = "distracted";
        if (SPAN_CATEGORY_COLORS[c.name]) cMap[c.name] = SPAN_CATEGORY_COLORS[c.name];
      });
      categoryProductivityMap = pMap;
      categoryColorMap = cMap;
      categoryIconMap = {};
      categoryModeMap = {};
      categoryList = cats.map((c) => ({
        name: c.name,
        type: c.default_productivity === "distracting" ? "distracted" : c.default_productivity,
        color: SPAN_CATEGORY_COLORS[c.name] || DEFAULT_CATEGORY_COLOR
      }));
      console.log("Span category metadata loaded:", categoryList.length, "categories");
      await loadModeMetadata();
      return;
    }
    const categories = await window.activeWindow?.loadCategories?.();
    if (Array.isArray(categories)) {
      const [productive = [], distracted = []] = categories;
      const map = {};
      productive.forEach((name) => {
        map[name] = "productive";
      });
      distracted.forEach((name) => {
        map[name] = "distracted";
      });
      categoryProductivityMap = map;
    }
  } catch (error) {
    console.error("Error loading category metadata:", error);
  }
}
async function loadModeMetadata() {
  try {
    const [modes, defaultModes] = await Promise.all([
      window.activeWindow?.loadAllModes ? window.activeWindow.loadAllModes() : [],
      window.activeWindow?.loadCategoryDefaultModes ? window.activeWindow.loadCategoryDefaultModes() : {}
    ]);
    if (Array.isArray(modes) && modes.length > 0) {
      const rMap = {};
      const mcMap = {};
      const miMap = {};
      modes.forEach((m) => {
        if (!m || !m.name) return;
        if (m.rollup) rMap[m.name] = m.rollup;
        if (m.color) mcMap[m.name] = m.color;
        if (m.icon) miMap[m.name] = m.icon;
      });
      modeRollupMap = rMap;
      modeColorMap = mcMap;
      modeIconMap = miMap;
      modeList = modes;
    }
    if (defaultModes && typeof defaultModes === "object") {
      categoryModeMap = { ...categoryModeMap, ...defaultModes };
    }
    console.log("Mode metadata loaded:", modeList.length, "modes");
  } catch (error) {
    console.error("Error loading mode metadata:", error);
  }
}
loadCategoryProductivityMapping();
var getMode = (category) => {
  return categoryModeMap[category] || FALLBACK_CATEGORY_MODE[category] || DEFAULT_MODE;
};

// src/renderer/src/components/Dashboard/DayTimeline.jsx
import { jsx, jsxs } from "react/jsx-runtime";
var MODE_ORDER = ["Deep work", "Creative", "Collaboration", "Break", "Distraction"];
var MODE_TOKEN = {
  "Deep work": "var(--c-deep)",
  Creative: "var(--c-create)",
  Collaboration: "var(--c-comms)",
  Break: "var(--c-break)",
  Distraction: "var(--c-distract)"
};
var modeColor = (mode) => MODE_TOKEN[mode] || "var(--fb-muted)";
var modeForApp = (app) => app && app.mode ? app.mode : getMode(app ? app.category : void 0);
var clock = (mins) => {
  const total = Math.round(mins);
  let hh = Math.floor(total / 60) % 24;
  const mm = (total % 60 + 60) % 60;
  const ap = hh >= 12 ? "PM" : "AM";
  let h = hh % 12;
  if (h === 0) h = 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ap}`;
};
var fmtDur = (mins) => {
  const m = Math.max(1, Math.round(mins));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h && rem) return `${h}h ${rem}m`;
  if (h) return `${h}h`;
  return `${rem}m`;
};
var startMinutes = (startStr) => {
  const d = new Date(startStr);
  if (isNaN(d)) return null;
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};
function buildSegments(rawData, date) {
  const day = rawData?.[date];
  if (!day) return { segments: [], startHour: 8, endHour: 19 };
  const segments = [];
  for (const [key, hourData] of Object.entries(day)) {
    if (key === "apps") continue;
    const hour = parseInt(key.split(":")[0], 10);
    if (isNaN(hour)) continue;
    for (const [name, d] of Object.entries(hourData)) {
      const label = d.domain || d.description || name;
      const appId = label.toLowerCase();
      const mode = modeForApp(d);
      const stamps = Array.isArray(d.timestamps) ? d.timestamps : [];
      const usable = stamps.map((ts) => ({ start: startMinutes(ts.start), durMin: (ts.duration || 0) / 6e4 })).filter((ts) => ts.start != null && ts.durMin > 0);
      if (usable.length > 0) {
        for (const ts of usable) {
          segments.push({
            startMin: ts.start,
            endMin: ts.start + ts.durMin,
            mode,
            category: d.category,
            label,
            appId,
            ms: ts.durMin * 6e4,
            approx: false
          });
        }
      } else if (d.time > 0) {
        const durMin = d.time / 6e4;
        segments.push({
          startMin: hour * 60,
          endMin: hour * 60 + Math.min(60, durMin),
          mode,
          category: d.category,
          label,
          appId,
          ms: d.time,
          approx: true
        });
      }
    }
  }
  if (segments.length === 0) return { segments: [], startHour: 8, endHour: 19 };
  segments.sort((a, b) => a.startMin - b.startMin);
  const firstMin = segments[0].startMin;
  const lastMin = Math.max(...segments.map((s) => s.endMin));
  const startHour = Math.min(8, Math.floor(firstMin / 60));
  const endHour = Math.max(19, Math.ceil(lastMin / 60));
  return { segments, startHour, endHour };
}
function mergeBlocks(segments) {
  const blocks = [];
  const openByApp = /* @__PURE__ */ new Map();
  for (const seg of segments) {
    const open = openByApp.get(seg.appId);
    const contiguous = open && seg.startMin <= open.endMin + 2;
    if (contiguous) {
      open.endMin = Math.max(open.endMin, seg.endMin);
      open.totalMs += seg.ms;
      open.approx = open.approx || seg.approx;
    } else {
      const block = {
        appId: seg.appId,
        startMin: seg.startMin,
        endMin: seg.endMin,
        mode: seg.mode,
        category: seg.category,
        label: seg.label,
        totalMs: seg.ms,
        approx: seg.approx
      };
      blocks.push(block);
      openByApp.set(seg.appId, block);
    }
  }
  blocks.sort((a, b) => a.startMin - b.startMin);
  return blocks;
}
function DayTimeline({ rawData, date }) {
  const [hover, setHover] = useState(null);
  const { blocks, startHour, endHour } = useMemo(() => {
    const { segments, startHour: startHour2, endHour: endHour2 } = buildSegments(rawData, date);
    return { blocks: mergeBlocks(segments), startHour: startHour2, endHour: endHour2 };
  }, [rawData, date]);
  const START = startHour * 60;
  const END = endHour * 60;
  const SPAN = Math.max(1, END - START);
  const tlBlocks = blocks.map((b, i) => {
    const durMin = b.totalMs / 6e4;
    const prefix = b.approx ? "~" : "";
    return {
      i,
      left: (b.startMin - START) / SPAN * 100,
      width: Math.max(0.6, (b.endMin - b.startMin) / SPAN * 100),
      color: modeColor(b.mode),
      label: b.label,
      cat: b.mode,
      range: `${prefix}${clock(b.startMin)} \u2013 ${clock(b.endMin)}`,
      dur: fmtDur(durMin),
      opacity: hover == null || hover === i ? 1 : 0.38
    };
  });
  const ticks = [];
  for (let h = startHour; h <= endHour; h++) {
    ticks.push({
      label: (h % 12 === 0 ? 12 : h % 12) + (h >= 12 ? "p" : "a"),
      left: (h * 60 - START) / SPAN * 100
    });
  }
  const hoverInfo = hover != null && tlBlocks[hover] ? tlBlocks[hover] : null;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { className: "flex gap-4 flex-wrap mb-4", children: MODE_ORDER.map((m) => /* @__PURE__ */ jsx(Legend, { color: MODE_TOKEN[m], label: m }, m)) }),
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      hoverInfo && /* @__PURE__ */ jsx(
        "div",
        {
          className: "absolute z-20 pointer-events-none",
          style: { bottom: "calc(100% + 12px)", left: `${hoverInfo.left + hoverInfo.width / 2}%`, transform: "translateX(-50%)" },
          children: /* @__PURE__ */ jsxs("div", { className: "rounded-xl px-3.5 py-2.5 min-w-[160px] text-white shadow-lg", style: { background: "var(--fb-tip)" }, children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/65", children: [
              /* @__PURE__ */ jsx("span", { className: "w-2 h-2 rounded-[3px]", style: { background: hoverInfo.color } }),
              hoverInfo.cat
            ] }),
            /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold mt-1.5 truncate max-w-[220px]", children: hoverInfo.label }),
            /* @__PURE__ */ jsxs("div", { className: "text-[12.5px] text-white/70 mt-0.5", children: [
              hoverInfo.range,
              " \xB7 ",
              hoverInfo.dur
            ] })
          ] })
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "relative h-[60px] rounded-xl overflow-hidden", style: { background: "var(--fb-track)" }, children: [
        tlBlocks.length === 0 && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center text-[13px] text-fb-muted", children: "No activity tracked for this day" }),
        tlBlocks.map((b) => /* @__PURE__ */ jsx(
          "div",
          {
            onMouseEnter: () => setHover(b.i),
            onMouseLeave: () => setHover(null),
            className: "absolute top-[5px] bottom-[5px] rounded-md cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
            style: { left: `${b.left}%`, width: `calc(${b.width}% - 2px)`, background: b.color, opacity: b.opacity }
          },
          b.i
        ))
      ] }),
      /* @__PURE__ */ jsx("div", { className: "relative h-[18px] mt-2", children: ticks.map((t, i) => /* @__PURE__ */ jsx(
        "span",
        {
          className: "absolute text-[11px] font-medium text-fb-muted",
          style: { left: `${t.left}%`, transform: "translateX(-50%)" },
          children: t.label
        },
        i
      )) })
    ] })
  ] });
}
function Legend({ color, label }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 text-[12.5px] font-semibold text-fb-muted", children: [
    /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 rounded-[3px]", style: { background: color } }),
    label
  ] });
}
export {
  buildSegments,
  DayTimeline as default,
  mergeBlocks
};
