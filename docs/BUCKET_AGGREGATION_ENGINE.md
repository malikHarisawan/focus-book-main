# Bucket Aggregation Engine — Design

Turns the immutable span log into the **per-bucket component totals** the "Focus over
time" chart draws — one row per hour (day view) or per day (week/month view). Today
this is done in the renderer by [`processProductiveChartData`](../src/renderer/src/utils/dataProcessor.js),
which seeds every bucket to zero and adds up whatever spans exist. That is where the
chart's honesty bugs live: an hour the app never ran is indistinguishable from an hour
of measured-zero, the displayed components don't sum to the displayed total, and a
minute goes missing between "Focused + Distracted" and "Total".

> **One-line summary.** A bucket is a *claim about a slice of time*, and the claim must
> be complete: every second in the bucket is accounted for as Focused, Distracted, or
> **Untracked** — and Untracked is a value the chart draws as a gap, never as zero.

This is the **aggregation-layer** instance of the project's one data shape. Nothing in
the span log is rewritten; the bucket totals are a pure, re-derivable *view* over it,
recomputed on every read so a rule edit re-buckets retroactively — exactly as category
resolution already does.

| Log (immutable observation) | Interpretation layer (mutable, resolved at query time) |
|---|---|
| `span` — what app/URL ran | `rule` → category → **Focused / Distracted verdict** |
| `presence_span` — was the user here | `span_annotation` — what the absence meant |
| **the wall clock — every bucket's full duration** | **this engine — spans tile the bucket; the remainder is `untracked`** |

The invariant this engine enforces is the **gapless invariant, moved up to the
aggregation layer**: just as the span log must tile the timeline with no holes, a
bucket's components must exhaust the bucket. Same policy, shown in pixels.

---

## 0. Product decisions this spec encodes

Two calls were made deliberately; the whole design follows from them.

1. **Binary verdict — there is no "neutral".** Every tracked second is either
   **Focused** or **Distracted**. The old three-band model (productive / neutral /
   distracting) is collapsed to two. This makes the tooltip's `Total = Focused +
   Distracted` **true by construction** instead of a coincidence that happened to
   exclude neutral.

2. **Not-clearly-productive counts as Distracted.** The minutes that used to roll up to
   neutral — `Break`, uncategorized apps, unknown apps, anything a rule maps to
   `Neutral` — now roll up to **Distracted**. Rationale: "if it wasn't focused work, it
   was a distraction." This keeps Focused% conservative and honest, and means an
   uncategorized app can never quietly inflate your focus number.

The verdict rollup (the single source of truth every layer must import):

| Mode / category | Verdict |
|---|---|
| Deep work | **Focused** |
| Creative | **Focused** |
| Collaboration | **Focused** |
| Break | Distracted |
| Distraction / Social | Distracted |
| Uncategorized / unknown app | Distracted |
| *(any rule verdict not `productive`)* | Distracted |

> There is exactly **one** place this table may live in code (see §6). Every consumer —
> chart, tooltip, summary cards, donut — imports it. A second copy is how the numbers
> drift apart again.

---

## 1. The bucket contract

A bucket is `{ label, focusedMs, distractedMs, untrackedMs, tracked }` where:

```
focusedMs + distractedMs + untrackedMs === bucketDurationMs      (EXHAUSTION)
tracked === (focusedMs + distractedMs) > 0                        (TRACKED FLAG)
```

- `bucketDurationMs` is **known a priori**: 3_600_000 for an hour bucket, 86_400_000 for
  a day bucket. It does **not** depend on the data. This is what makes days comparable
  (§4) and what makes "untracked" computable at all.
- `untrackedMs = bucketDurationMs − focusedMs − distractedMs`, clamped to `≥ 0`.
  (Clamp guards against float drift and against a bucket that overlaps two spans by a
  hair; over-attribution is capped at the bucket, never negative.)
- `tracked` is the flag the chart reads to decide **gap vs value** (§2). A bucket with
  `tracked === false` is a no-data bucket — the app produced no span touching it.

**Exhaustion is an assertion, not a hope.** The builder computes `focusedMs` and
`distractedMs` by summing spans, then *derives* `untrackedMs` as the remainder. The
three can never fail to sum to the bucket, because the third is defined as "whatever's
left." This is the aggregation analog of the presence log's gapless tiling: you don't
sum three independent numbers and pray they add up; you measure two and define the third
as the closure.

---

## 2. Untracked ≠ zero (the correctness bug wearing a design costume)

Today [`processProductiveChartData`](../src/renderer/src/utils/dataProcessor.js#L498-L502)
seeds all 24 hours as `emptyPoint` — `{ focused: 0, distracted: 0 }`. An hour you were
asleep and the app was closed renders **identically** to an hour you sat at the machine
and did nothing. That is the same mistake as letting a crash gap silently extend the
last span: **collapsing "no evidence" into "evidence of zero."**

The fix is the `tracked` flag. A bucket is `tracked: false` **iff no span touches it**.
The chart then renders untracked buckets as an explicit gap — not a zero-height point on
a continuous line.

- **Day/hour view:** an untracked hour is a **gap in the series** (null value → the line
  breaks, or the bar is simply absent). It is *not* a data point at y=0.
- **Optional affordance:** a faint hatched band behind untracked buckets ("app wasn't
  running") so the gap reads as *known-absent*, not *broken chart*.

Practically: a genuine measured-zero (present, produced spans, but zero focused time —
possible only at coarser buckets) is a finding. An untracked hour is not. Averaging them
poisons every derived stat (daily Focus%, streaks, "your best hour"). The `tracked` flag
is what keeps them apart end to end.

> **Data source for "the app was running."** The strongest signal is the `presence_span`
> log (§ Presence engine): any presence span — even `idle`/`locked` — intersecting the
> bucket means the app was alive, so the bucket is *tracked with zero focused time*, not
> untracked. Until the presence log is wired in, the fallback is "a bucket is tracked iff
> ≥1 activity span intersects it." The fallback slightly over-reports untracked (a fully
> idle hour looks untracked), which is the safe direction: it never invents activity.

---

## 3. One rounding pass (the bug users actually notice)

The tooltip today reads `Focused 4m, Distracted 1m, Total 6m, Productivity 76%` — and
every one of those is arithmetically inconsistent with the others, because each is
rounded **independently from raw seconds**:

- `Total` is summed from raw seconds *then* rounded (`5.6m → "6m"`), while `Focused` and
  `Distracted` are each rounded alone (`4.4m → "4m"`, `1.2m → "1m"`). Displayed parts say
  5, displayed total says 6.
- `Productivity%` is `4.4 / (4.4+1.2)` computed on raw seconds (`≈ 76%`), shown next to
  the rounded "4m" and "1m" (which read as 80%).

**Rule: round once, at the display boundary, then derive everything else from the rounded
values.**

```
const fMin = Math.round(focusedMs / 60000)
const dMin = Math.round(distractedMs / 60000)
const totalMin = fMin + dMin                       // derived from rounded parts — always sums
const pct = totalMin > 0 ? Math.round((fMin / totalMin) * 100) : null
```

Now `4 + 1 = 5` on screen, and `%` is computed from the same integers the user can see
and add up themselves. The displayed components **always** reconcile with the displayed
total, because the total is *defined as their sum* — not independently rounded.

The binary model (§0) makes this airtight: with no neutral band, `Total = Focused +
Distracted` is not just reconciled, it's the entire bucket's tracked time. There is no
third component to go missing.

> Percentage is `null` (hidden), not `0%`, when `totalMin === 0`. "0% productive" on an
> hour with no tracked time is another untracked-as-zero lie.

---

## 4. Fixed bucket ceiling (free insight the current chart destroys)

The Y-axis has no `domain`, so Recharts scales to the data max — producing the
`0 / 9 / 18 / 28 / 37` ticks. Two problems:

1. **Nobody thinks in 28-minute increments.** Ticks must snap to nice numbers.
2. **A data-driven max makes days incomparable.** A 37m-peak day and a 12m-peak day both
   touch the ceiling and render identically.

Because a bucket's *maximum possible* value is knowable — an hour holds 60 minutes — pin
the ceiling to the bucket duration:

| View | Bucket | Y-max | Ticks |
|---|---|---|---|
| hour / day | 1 hour | **60m** | 0 / 15 / 30 / 45 / 60 |
| week / month | 1 day | choose a sane cap (e.g. 12h active) or nice-number the max | 0 / 3h / 6h / 9h / 12h |

With a pinned hour ceiling, **bar height means the same thing every day**, and a
half-full bar reads instantly as "half that hour was tracked" — the tracked-vs-untracked
split becomes visible *in the geometry*, for free. (Day-bucket max is a judgment call
since a day has no natural "full"; nice-number the observed max there, but keep the hour
axis pinned.)

---

## 5. Steps, not splines (don't draw data you didn't observe)

Buckets are **discrete measurements**. The chart uses `type="monotoneX"`, which draws a
smooth curve between bucket centers — implying a continuous signal that was sampled
everywhere, when in fact you have one number per hour.

- Switch the area/line interpolation to **`type="stepAfter"`** (or render as bars). A
  step holds each bucket's value across the bucket's width and jumps at the boundary —
  which is what a bucket *is*.
- Correction to the original critique: `monotoneX` specifically does **not** overshoot
  (that's its guarantee vs `natural`/`basis`), so the curve never implied a fake 37m
  peak *above* a sample. The real problem is subtler and still real: it invents plausible
  intermediate values *between* samples where no measurement exists. Steps refuse to.

---

## 6. Where the code changes land

| Concern | File | Change |
|---|---|---|
| Verdict rollup (§0) | [dataProcessor.js](../src/renderer/src/utils/dataProcessor.js) | Collapse `productive/neutral/distracting` → `focused/distracted`; map every non-productive verdict to `distracted`. **Single exported table.** |
| Bucket builder (§1, §2) | [processProductiveChartData](../src/renderer/src/utils/dataProcessor.js#L466) | Emit `{ focusedMs, distractedMs, untrackedMs, tracked }` per bucket; derive `untrackedMs` as remainder; set `tracked` from span/presence intersection instead of seeding zeros. |
| Gap rendering (§2) | [ProductiveAreaChart.jsx](../src/renderer/src/components/Dashboard/ProductiveAreaChart/ProductiveAreaChart.jsx) | Untracked buckets → `null`/absent, not y=0. Optional hatch band. |
| Y ceiling + steps (§4, §5) | [ProductiveAreaChart.jsx](../src/renderer/src/components/Dashboard/ProductiveAreaChart/ProductiveAreaChart.jsx#L400) | `YAxis domain={[0, 3600]}` + nice ticks; `type="stepAfter"`. |
| One rounding pass (§3) | [CustomTooltip.jsx](../src/renderer/src/components/Dashboard/ProductiveAreaChart/components/CustomTooltip.jsx#L38-L57) | Round parts once; derive total & % from rounded ints; hide % when total is 0. |
| Tooltip position + dedupe (§7) | [CustomTooltip.jsx](../src/renderer/src/components/Dashboard/ProductiveAreaChart/components/CustomTooltip.jsx), [chart Tooltip](../src/renderer/src/components/Dashboard/ProductiveAreaChart/ProductiveAreaChart.jsx#L414-L418) | Flip tooltip away from the peak; drop the duplicated "By mode" rows that restate Focused/Distracted. |
| Consumers that must not drift | [getProductivityTotals](../src/renderer/src/utils/dataProcessor.js#L387), [getModeTotals](../src/renderer/src/utils/dataProcessor.js#L427), summary cards, donut | Re-point at the single verdict table so cards/donut/chart/tooltip all reconcile to the same integers. |

**Downstream to check when neutral disappears:** anything that reads a `neutral` /
`neutralSeconds` key — the summary stat cards, the Focus-balance donut, and any
`getProductivity`/`getModeRollup` caller. Grep for `neutral` before ripping it out; some
call sites destructure it. The mode taxonomy (`Deep work`/`Break`/…) can stay as-is;
only its **rollup** collapses to two verdicts.

---

## 7. Tooltip (two smaller honesty fixes)

- **Position.** `position={{ y: -30 }}` is static, so at the day's single peak the
  tooltip parks directly over the only data, hiding what you're hovering. Flip it to the
  opposite side of the cursor when it would overlap the peak (compute from the hovered
  x-fraction; right-align past the midpoint).
- **Dedupe.** The tooltip says the same numbers twice — "Focused 4m / Distracted 1m" and
  then "By mode: Deep work 4m / Distraction 1m." With the binary model these are the same
  data wearing two hats. Keep the Focused/Distracted rows; drop the "By mode" block on the
  chart tooltip (mode detail lives on the donut and the day timeline).

---

## 8. Test invariants (assert these, don't eyeball them)

The whole point of an exhaustive bucket is that it's *auditable*. Encode that:

1. **Exhaustion.** For every bucket: `focusedMs + distractedMs + untrackedMs ===
   bucketDurationMs` (exactly; `untrackedMs` is the derived remainder so this is
   definitional, but assert it to catch a clamp regression).
2. **No negative untracked.** `untrackedMs >= 0` even when spans over-attribute (float
   drift / boundary overlap).
3. **Tracked flag matches spans.** `tracked === (≥1 span intersects the bucket)`; a
   bucket with no spans is `tracked: false` and renders as a gap.
4. **Display reconciles.** For the tooltip's rounded integers: `totalMin === fMin +
   dMin`, and `pct` is `null` iff `totalMin === 0`.
5. **Binary closure.** No bucket ever emits a `neutral` field; every classified second
   lands in exactly one of focused/distracted.
6. **Retroactivity.** Re-running the builder after a rule edit changes the split without
   touching the span log (the buckets are a pure view).

---

## Appendix — why this keeps being the same problem

Five turns of chart fixes, one principle deciding every call:

| Chart symptom | The invariant underneath |
|---|---|
| Untracked hours drawn as zero | Untracked ≠ zero — the gapless invariant ("no evidence" is not "evidence of none") |
| Components don't sum to the total | Components exhaust the bucket — gapless tiling at the aggregation layer |
| A minute goes missing | Same — closure over the bucket makes it impossible |
| Spline invents between-sample values | Don't invent data you didn't observe |
| Data-driven y-max makes days incomparable | A bucket's ceiling is knowable; pin it |

The chart layer isn't a separate design problem. It's the span log's honesty policy
showing up in pixels.
