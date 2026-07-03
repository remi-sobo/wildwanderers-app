# DESIGN.md — Wild Wanderers Platform

The app is a Wild Wanderers product. It carries the exact brand from the marketing
site, then extends it for a working tool with dense data, dashboards, and daily
logging. Calm, warm, editorial, and clean. It should feel like the website grew a
back office, not like a generic SaaS dashboard wearing brand colors.

This is Gabe's brand, not SOBO's. Bone and forest and Fraunces. Never SOBO's cream
and Cormorant.

The signature move that keeps it on brand and makes it look distinctive: a dark
forest chrome (the nav rail and headers) wrapping a warm bone workspace with
paper-white cards. That is the site's bone-and-forest rhythm turned into an app
shell. Most coaching tools are cold and white. This one is warm and lit.

---

## 1. Color

Brand tokens, ported verbatim from the site's `globals.css`. Do not change these.

```
--color-bone: #f6f1e7      canvas
--color-bone-dim: #ede4d3  insets, table stripes
--color-sand: #e7d9bf      warm blocks
--color-ink: #2a2118       primary text
--color-bark: #6b4a2e      labels, secondary accent
--color-forest: #2e4a33    primary brand green
--color-forest-deep: #1e331f  dark chrome, deepest surface
--color-fern: #5f9a4f      positive, on-track
--color-amber: #d98a3a     the one action color
--color-amber-deep: #bf6f1c  hover, pressed
--color-mist: #c4d3cc      cool hairline on dark, chart reference
--color-cream: #f2c879     display accent on dark
```

### App surfaces (new, built on the brand)
A clear stack so a dense screen still reads:

```
--surface-chrome: #1e331f     forest-deep. nav rail, top bar, dark headers
--surface-canvas: #f6f1e7     bone. the workspace behind cards
--surface-card: #fdfbf5       warm paper. raised cards, panels
--surface-inset: #ede4d3      bone-dim. wells, table stripe, code, disabled
--border-hair: rgba(42,33,24,0.12)   default hairline
--border-strong: rgba(42,33,24,0.20) emphasized divider, input border
--shadow-card: 0 1px 2px rgba(42,33,24,.05), 0 8px 24px rgba(42,33,24,.06)
```

Rule from the site holds: forest leads, bone is the canvas, and amber is the only
color that shouts. If everything is amber, nothing is. One primary action per view.

### Functional neutrals (warm, never cold gray)
```
--text-strong: #2a2118    ink
--text: #4a4234           body
--text-muted: #7a7264     secondary, captions
--text-faint: #9c9482     placeholder, disabled
```
Cool gray would fight the paper. Stay in the warm family.

### State colors (earthy, not neon)
```
--state-good: #5f9a4f     fern. complete, active, on-track, healthy streak
--state-caution: #c0942e  ochre. draft, pending, attention (distinct from amber)
--state-error: #b4472e    brick red. destructive, failed. warm, never fire-engine
--state-info: #2e4a33     forest. neutral highlight, info
```
Caution is a separate ochre on purpose, so it never competes with amber the action
color. Error is a warm brick, because a wellness app should never flash an angry
red at a human about their body. See section 7.

### Data visualization
Charts are calm and warm. Transparent backgrounds, faint bark grid, Jakarta
labels, Fraunces for any big number.
```
Categorical: forest #2e4a33, amber #d98a3a, fern #5f9a4f, bark #6b4a2e,
             sage #7c9a6e, slate-green #4e7c74
Sequential (intensity): forest-deep -> forest -> fern -> cream
Primary metric line: forest or amber. Target/reference line: mist, dashed.
```
Never plot a person's body metric in error-red. Progress is forest and amber.

---

## 2. Type

Same two families as the site, self-hosted, already wired.

- Fraunces (`--font-display`): page titles, section headers, empty-state
  headlines, and the signature move, big stat numerals. A client's weight, their
  wellness score, a streak count, a revenue figure, all render in Fraunces, large.
  Numbers as editorial display is the brand's fingerprint. Carry it in.
- Plus Jakarta Sans (`--font-sans`): everything functional. Body, labels, tables,
  forms, buttons, nav, chart axes.
- Italic is for accent words only, never for data.
- The `.eyebrow` primitive (Jakarta 12px, .28em, uppercase, weight 600) labels
  sections in the app just as on the site.

App type scale (denser than the marketing site, which runs big):
```
Page title (Fraunces)        30 / 34
Stat numeral (Fraunces)      40 to 64, weight ~380
Card / section head (Fraunces) 20 / 26
Body (Jakarta)               14.5, line 1.55
Label, table header (Jakarta)  12 to 13, muted
Eyebrow                      12, .28em, uppercase
```

---

## 3. Space, shape, density

- 8px base grid. Card padding 20 to 24. Section gaps 24 to 32. Tighter inside
  tables and lists, generous around heroes and empty states.
- Radius: cards and panels 16 to 20, inputs and small controls 10 to 12, pills and
  buttons full. This matches the site's rounded, soft feel.
- Two densities. The coach side is data-dense and efficient. The client side is
  roomy, calm, and thumb-friendly, since it lives on a phone.

---

## 4. The two shells

### Coach and business shell (desktop-first)
- Left rail in `--surface-chrome` forest-deep, bone text, Lucide icons. A very
  faint Contours watermark in the rail, low opacity, never behind data.
- At the top of the rail, the surface switch: Program, Fitness, Business. This is
  the one place Gabe changes hats. Active surface marked with an amber indicator
  and a subtle lift. Fraunces label.
- Top bar: page title in Fraunces, breadcrumb or context in Jakarta muted, and the
  account on the right. Thin `--border-hair` under it.
- Workspace: bone canvas, paper cards, calm.

### Client shell (mobile-first, installable PWA)
- Bottom tab bar, warm paper with a hairline top border, amber active tab. Tabs:
  Home, Training, Log, Progress, Messages.
- Bone canvas, paper cards, big touch targets (44px minimum), one primary action
  per screen in amber.
- A short Ridgeline strip can crown the Home header, the one bit of scenery, then
  the data stays clean below it.

---

## 5. Components

Reuse the site's primitives directly: `Button` (amber primary with the left-wipe
and arrow nudge, plus ghost), `Eyebrow`, `Section`, `Container`, `Contours`,
`Ridgeline`. Add these app patterns, all built from the tokens above.

- Stat tile: big Fraunces numeral, Jakarta label, a small trend chip in fern or
  ochre. The workhorse of every dashboard.
- Data card and list card: paper surface, hairline border, soft shadow, a hover
  lift on interactive ones.
- Table: paper surface, `--surface-inset` zebra stripes, hairline row dividers,
  Jakarta 13 to 14, right-aligned numbers in a lining figure. Sticky header on
  long lists.
- Charts: recharts styled to section 1's data palette. Faint grid, no chart junk,
  lots of air.
- Forms: paper fields, `--border-strong` border, the existing amber focus ring
  (`:focus-visible` outline amber, offset 3), 10 to 12 radius, clear inline help,
  errors in brick with plain language.
- Status pill: fern for active or complete, ochre for draft or pending, mist for
  archived. Small, quiet.
- Badges, streaks, milestones: the motivation layer. Earned badges as warm tokens
  in amber and forest, streaks in fern with a small flame, celebratory but never
  loud. Tasteful, not an arcade.
- Toasts (sonner): paper surface, forest text, fern or brick accent stripe.
- Secondary and destructive buttons: secondary is a forest outline or muted forest
  fill, used for the non-primary action. Destructive is brick, used rarely and
  always behind a confirm.

Additional buttons extend the existing `Button` component, they do not replace it.

---

## 6. Motion

The app is calm, not cinematic. The marketing site's GSAP scroll show stays on the
site.

- Enter: cards fade and rise a few pixels on mount, quick, 150 to 250ms.
- Numbers: stat numerals count up on first paint, gated to no-preference.
- Reuse the site's button micro-interaction and link-underline draw.
- Hover: a small lift and shadow on interactive cards.
- Everything gates behind `prefers-reduced-motion`. The site's global reduce-motion
  net is already in `globals.css`, carry it over. Motion never blocks a task.

---

## 7. The guardrails that are also design rules

- Never frame a client as broken. Empty states, errors, and the wellness score are
  encouraging, plain, and forward-looking. Not "you have no data" but "log your
  first workout and it shows up here." The plan needs work, never the person.
- The wellness score is motivational, not medical. Show it as a warm progress ring
  or a big Fraunces number in fern to amber, paired with a supportive line and a
  small "what this means" note that says plainly it is a progress signal, not a
  health diagnosis. Never render a body metric in error-red, never a failing grade.
- Amber is the only action color. One primary action per view.
- Motifs are seasoning. Contours and Ridgeline appear at login, empty states,
  headers, and dark chrome at low opacity. Never behind tables, charts, or dense
  data, where they hurt legibility.
- Contrast and touch. Ink on bone and bone on forest-deep are safe. Verify state
  colors at text sizes. Real focus rings everywhere. 44px touch targets on the
  client PWA.

---

## 8. Voice in the UI

Every human-facing string follows the SOBO voice rules. No em dashes. No AI words
(transformative, holistic, leverage, unlock, seamless, robust, pivotal). Warm,
direct, clear, short. Encouraging on the client side, precise on the coach side.
Labels are plain nouns. Empty states offer the next step, not an apology.
