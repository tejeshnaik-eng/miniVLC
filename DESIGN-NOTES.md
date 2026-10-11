# Lumen — design notes

A working summary of `DESIGN.md` (Apple design analysis) and how Lumen adapts it.
Read this before touching any UI. `DESIGN.md` stays untouched as the source.

## What Apple's system says (short version)

- **One accent.** Action Blue is the only interactive color. On dark surfaces it is
  the lighter Sky Blue `#2997ff`. Never introduce a second accent.
- **Chrome recedes.** Surfaces do the work: a change in tone is the divider,
  not a border or a shadow. Hairlines are `rgba(255,255,255,.08)`.
- **Type.** SF Pro (system-ui on macOS). Display sits at weight 600 with negative
  tracking (about -0.011em). The ladder is 300 / 400 / 600 / 700. **Weight 500 is never used.**
- **Radii grammar.** 8 (compact) · 11 (capsule) · 18 (card) · pill (actions).
  Nothing in between.
- **Buttons.** Pill-shaped, solid fill. Press state is `transform: scale(.95)`.
  There is no documented hover state.
- **Dark surfaces.** `#272729`, `#2a2a2c`, `#252527`, and true black `#000`.
- **Spacing.** 8px base: 4 · 8 · 12 · 17 · 24 · 32 · 48.
- **Only one shadow exists** and it belongs to the thing being shown, not to UI chrome.

## Rules from the brief (these win over DESIGN.md)

1. **No "tinted outline" buttons or chips.** Never combine a same-color border, dot and
   label (the `● Status` pill). Buttons are **solid**. Status is expressed with
   shape (checkbox fill, icon) or plain neutral text.
2. **Real Liquid Glass.** Glass surfaces refract what is behind them, using an SVG
   displacement map applied through `backdrop-filter` (`src/glass.js`), with
   specular rims and slight chromatic dispersion. It is not a plain blur.
3. **Dark mode only.**
4. **Glass is the control layer.** Sidebar, toolbars, dock, zoom, minimap, context bar.
   **Content is solid** (boards, notes, tasks, time blocks) and sits underneath.
5. UI only. No real behaviour beyond switching between the three views for review.

## Deliberate adaptations (and why)

| DESIGN.md says | Lumen does | Why |
|---|---|---|
| No decorative gradients | A quiet ambient wallpaper sits behind everything | Glass needs colour behind it to refract; the wallpaper plays the role of Apple's photography. |
| No shadows on chrome | One soft ambient shadow, only on floating glass | Glass otherwise vanishes into dark surfaces. |
| 17px body | 15px body, 13px caption, 11px micro | This is a dense app, not a marketing page. Tracking and weights still follow the ladder. |
| Single accent | Accent also marks *selection* and *now* | Both are interactive-adjacent states. Categories on the timetable use **low-chroma tones** in fill only, never on controls. |
| Radii 8/11/18/pill | Adds `--r-glass: 28px` for large floating glass panels | Concentric with 18px cards inside. |

## Tokens (see `src/styles/tokens.css`)

Surfaces `#000 · #0b0b0d · #1c1c1e · #272729 · #2a2a2c`
Text `#fff · rgba(255,255,255,.64) · rgba(255,255,255,.40)`
Accent `#2997ff` (fill `#0071e3` behind white text for AA contrast)
Content tones (fill only) sand · sage · slate · mauve

## Copy

Sentence case. Verbs for actions ("Add task", "Link board"). Empty states say what to do next.

## Settings sheet

Two-pane sheet: a glass frame (control layer) holding solid grouped lists (content).
It replaces the usual "uppercase label + chip + slider" settings panel.

- Section titles are sentence case, 13/600, secondary colour. No uppercase, no tracking.
- Choices are shown, not named: style and wallpaper are preview tiles with an accent ring
  when selected. No `● Name` chips.
- Accent is user-selectable. Swatches carry a white ring and a check; choosing one only
  swaps `--accent` and `--accent-fill` (fill colours are pre-checked for white-text contrast).
- Numeric values use steppers (precise) or a slider with a live value (continuous).
- Destructive or low-emphasis actions ("Remove", "Reset") are ghost buttons: no border, no red.
- Toggles use the accent fill. The sheet tint is 80% opaque so text never fights the canvas behind it.

## Lumina (study notes)

Same system as Lumen, applied to a three-pane notes app.

- **Layout:** floating glass sidebar, then one solid rounded sheet holding three columns
  (notes list · note · reference panel), split by hairlines.
- **Glass floats over scrolling content.** The note toolbar and the reference-panel tabs are
  glass bars pinned above content that scrolls beneath them, so the refraction is always real.
- **Glass over light content** (slides, photos) uses `.glass--dark` plus `data-brightness`
  below 1, otherwise white text disappears into a white slide. Menus use it too.
- **One primary button per screen:** "New note". Everything else is neutral or ghost.
- **Clutter becomes menus:** the six attach/browse buttons became one "Add slides" menu,
  a viewer/gallery toggle and a sort control.
- Slide numbers are neutral dark chips; the selected slide gets the accent ring.
- Formulas: serif italic math in an inset well, with the source slide as a neutral chip.
  Swap in KaTeX for real rendering.

## PDF viewer toolbar

- Three glass capsules, grouped by intent: **document** (title + page count) · **view**
  (page, zoom, layout, tools) · **actions** (Share, Attach). One primary button: Attach.
- Twelve flat controls became groups with dividers. Layout modes are an icon segmented
  control instead of a blue text toggle. Fit sits next to zoom, where it belongs.
- The page field is a fixed-width input with "of 25" beside it, so it never wraps.
- Glass here is `.glass--dark`: PDF pages are white, and light glass would lose its labels.
- Responsive by the viewer's own width (container queries), not the screen:
  wide = one row, ≤1120 Share loses its label, ≤960 two rows, ≤700 tools move into "More".
- The "Page n of N" chip floats at the bottom centre so it never covers content.

## MediaVault (local video library)

- **Artwork is the colour.** The selected video is blurred into the window backdrop, so the glass
  sidebar and details panel refract that video's palette. Selecting another card changes the mood.
- **Glass = controls, cards = content.** Search and sort/view float as glass over the scrolling grid.
  Thumbnails stay solid; titles sit *below* them on the dark surface instead of over the image.
- **One primary button per screen:** "Open in VLC". "Scan library" is neutral.
- **Nav is grouped and monochrome** (Watch, Collections). The old mix of coloured and missing icons is gone.
- **Progress is a thin bar on the thumbnail's bottom edge**; duration is a small dark chip.
- **Titles are cleaned** from release filenames (dots to spaces, quality tags moved to the meta
  line). The raw filename stays visible in the details panel.
- **Fits any window:** the grid is `auto-fill`. Below 1100px the sidebar becomes an icon rail
  and the details panel overlays instead of squeezing the grid. The toolbar keeps 150px clear
  of the Windows caption buttons (`--caption-safe`).

## Glass gotchas (learned the hard way)

1. **Tint specificity.** `glass.css` styles `.glass[data-glass="thick"]`. A plain `.panel { background }`
   loses to it. Override with `.panel.glass[data-glass] { background: … }`.
2. **Heavy blur + refraction order.** Chromium weakens a big `blur()` placed *after* an SVG
   `url()` filter, leaving a ghost of what's underneath. `glass.js` blurs first when `blur >= 8`
   and refracts first otherwise. Don't reorder it.
3. **No `mix-blend-mode` under glass.** A blend-mode element inside scrolling content makes
   Chromium paint that content *above* frosted glass. Use plain low-opacity overlays instead.
4. **Glass over light content** needs `.glass--dark` and `data-brightness` below 1.
5. **Glass never nests**, and stays out of transformed containers.
