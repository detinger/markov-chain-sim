# Markov Chain Simulator — Design and Interaction Specification

> Agent-ready companion to `PLAN.md`. Upgrade the existing Markov application using BPMN Studio's implemented design language. Preserve the graph, matrix, simulations, calculations, examples, and learning workflows while replacing the current glassmorphism with this compact analytical interface.

## Specification authority and provenance

**Exact transfer:** Sections 1–11 reproduce the supplied `STYLE(7).md` design rules, token values, dimensions, and source qualifications. References there to existing behavior or “the app” describe the BPMN Studio source, not a verified Markov implementation. They are the receiving app's visual baseline. Recommendations become Markov implementation requirements where §12–18 say so.

**Markov adaptation:** Sections 12–18 specify this product's branding, graph/matrix semantics, additional category colors, accessible interactions, page compositions, and acceptance gates. These additions are explicitly new; they must not be presented as original BPMN tokens. The complete CSS transfer in §12 is ready to implement after integrating with existing styles.

**Evidence boundary:** `README(2).md`, `PLAN(8).md`, and `STYLE(7).md` were supplied. The repositories and source files mentioned by the references were not inspected. All file paths below are proposed destination paths. Do not claim existing components implement these requirements before auditing them.

**Conflict rule:** `PLAN.md` owns mathematical meaning and feature preservation. This file owns appearance and interaction. Accessibility and scientific clarity may require a documented, local adaptation; do not silently change the inherited palette or entire spacing scale. There is no requirement to install a UI framework or a BPMN library.

## 1. Character and principles

The interface is a calm, compact workspace for learning and analytical work. Cool gray backgrounds, bordered white or dark slate surfaces, blue actions, small outline icons, and restrained orange highlights give it its identity.

- **Keep the work prominent.** Diagrams, explanations, forms, and results occupy most of the screen. Navigation and controls provide a quiet frame.
- **Use density with structure.** Compact controls sit in clearly grouped toolbars; larger gaps separate sections. Borders and spacing establish hierarchy before shadows do.
- **Give color a job.** Blue identifies actions and selection; orange highlights special activity or milestones; semantic colors explain outcomes.
- **Explain alongside action.** Place hints, validation, empty states, and next steps near the relevant task.
- **Treat both themes as complete designs.** Surfaces, controls, charts, and embedded workspaces all change together.

To retain this character, avoid oversized marketing headings, decorative gradients, glass effects, heavy shadows on every surface, or pill-shaped primary controls. Pills belong to badges, filters, and step indicators.

## 2. Color tokens

Use semantic CSS variables throughout components. Keep palette values in a central theme layer. A token's role stays the same when its value changes between themes.

### Surfaces and text

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--bg` | `#f4f6f9` | `#0f141b` | Application background |
| `--bg-elevated` | `#ffffff` | `#171e27` | Navigation, cards, controls, dialogs |
| `--bg-subtle` | `#eef1f5` | `#1c2430` | Quiet grouping, table headers, neutral fills |
| `--bg-sunken` | `#e6eaf0` | `#121821` | Recessed tracks, such as progress bars |
| `--bg-hover` | `#e9eef5` | `#233042` | Hovered rows and controls |
| `--border` | `#d6dce5` | `#2b3645` | Default 1px dividers and outlines |
| `--border-strong` | `#b7c1cf` | `#3b4a5e` | Stronger outlines and hover borders |
| `--text` | `#17202c` | `#e6ebf1` | Main content and headings |
| `--text-muted` | `#4b5867` | `#b2bdcb` | Descriptions, labels, inactive navigation |
| `--text-subtle` | `#6b7787` | `#8a97a8` | Metadata, hints, secondary annotations |
| `--text-on-primary` | `#ffffff` | `#0b1520` | Text and icons on solid primary fills |

### Brand and interaction

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--primary` | `#1f5f8b` | `#5aa7d8` | Main actions, links, focus borders, selection |
| `--primary-hover` | `#184d72` | `#7ab9e3` | Solid primary button hover |
| `--primary-soft` | `#e3eef7` | `#16314a` | Selected navigation, controls, explanatory panels |
| `--primary-strong` | `#123b59` | `#a8d3ef` | Emphasized text within primary-tinted content |
| `--accent` | `#d9822b` | `#f0a457` | Special actions, active simulation, achievements |
| `--accent-soft` | `#fbeedd` | `#3a2a17` | Soft accent badges |

Solid accent buttons and simulation banners use dark text `#1d1205` in both themes. Do not assume every saturated background takes white text.

### Semantic feedback

| Role | Foreground light / dark | Soft background light / dark | Use |
| --- | --- | --- | --- |
| Error | `#c0392b` / `#f2776a` | `#fbe9e7` / `#3b1d1a` | Failure, invalid input, destructive action |
| Warning | `#b7791f` / `#e8b45a` | `#fdf3dc` / `#3a2d14` | Caution, incomplete state, potential problem |
| Recommendation | `#2b6cb0` / `#79b2ec` | `#e6f0fa` / `#172a40` | Advice, explanation, suggested improvement |
| Info | `#5a6779` / `#a3afbf` | `#eef1f5` / `#1f2833` | Neutral information and metadata |
| Success | `#2f855a` / `#6fcf97` | `#e3f4ea` / `#16301f` | Completion, correct answers, improved outcomes |

Tokens follow `--error` / `--error-soft`, `--warning` / `--warning-soft`, and the same pattern for the other roles. Informational **callouts** deliberately use the blue recommendation palette; neutral information **badges** use the gray info palette.

Pair semantic colors with readable labels or recognizable icons. Improvement and deterioration depend on the metric: a lower duration may be good, while a lower completion count may be bad.

## 3. Typography

```css
--font-sans: 'Inter', 'IBM Plex Sans', system-ui, -apple-system,
  'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace,
  SFMono-Regular, Menlo, monospace;
```

The app declares these stacks without loading custom sans or monospace font files. The displayed font therefore depends on local availability. **Transfer recommendation:** self-host Inter and the desired monospace font if matching typography across machines is important; include the weights used below.

| Element | Size | Weight | Other properties |
| --- | --- | --- | --- |
| Body | 14px | 400 | Line height 1.5 |
| Home hero heading | 32px | 650 | Tracking `-0.02em` |
| Page heading / h1 | 26px | 650 | Tracking `-0.01em` |
| Section heading / h2 | 20px | 650 | Tracking `-0.01em` |
| Card heading / h3 | 16px | 650 | Tracking `-0.01em` |
| Subheading / h4 | 14px | 650 | Tracking `-0.01em` |
| Dialog heading | 17px | 650 | No bottom margin |
| Hero description | 15px | 400 | Muted text |
| Compact content / table body | 13px | 400 | Also used in side panels |
| Field label / table heading | 12px | 600 | Muted text |
| Hint | 12px | 400 | Subtle text |
| Small metadata / badge | 11px | 400 / 650 | Keep secondary |
| KPI value | 22px | 700 | Tracking `-0.02em`, tabular numerals |
| Eyebrow | 12px | 600 | Uppercase, tracking `0.08em`, primary color |
| Navigation group label | 11px | 400 | Uppercase, tracking `0.06em` |

Headings use line height 1.25 and bottom margin `0.5em`. Paragraphs use bottom margin `0.75em`. Body text remains sentence case; uppercase is reserved for short group labels and eyebrows.

Use monospace for code, identifiers, traces, and keyboard shortcuts. Inline `code` and `kbd` are `0.92em`. Use `font-variant-numeric: tabular-nums` for metrics, numeric table columns, zoom values, and comparisons. Explanatory prose is limited to `76ch`; page-header descriptions to `72ch`.

## 4. Spacing, shape, and elevation

Spacing is currently expressed as literal CSS values, not a named spacing-token system. These recurring values form the practical scale:

| Spacing | Typical use |
| --- | --- |
| 2–4px | Tight internal grouping, badge gaps, adjacent toolbar controls |
| 6px | Icon-to-label gaps, compact list gaps |
| 8px | Standard row gaps, small control padding |
| 10–12px | Form grids, compact surface padding, field separation |
| 14–16px | Panel padding, standard stacks and card-grid gaps |
| 18px | Default card and dialog-body padding |
| 20–24px | Page-header separation, larger layout gaps |
| 28–32px | Desktop page inset and hero spacing |
| 40–48px | Page bottom breathing room |

**Transfer recommendation:** expose these values as spacing tokens in the receiving system while keeping the original proportions. Do not force every dimension onto a new scale if visual fidelity is the goal.

| Token / shape | Value | Use |
| --- | --- | --- |
| `--radius-sm` | 6px | Buttons, inputs, tabs' surrounding surfaces, callouts, menus |
| `--radius` | 10px | Cards, KPI tiles, grouped content |
| `--radius-lg` | 14px | Dialogs |
| Small local radius | 4px | Keyboard keys, focus outline shape, chart bar ends |
| Pill radius | 999px | Badges, chips, progress tracks, lesson steps |

| Token | Light | Dark |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(16, 24, 40, 0.06)` | Same as light |
| `--shadow` | `0 2px 8px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.06)` | `0 2px 10px rgba(0, 0, 0, 0.45)` |
| `--shadow-lg` | `0 12px 32px rgba(16, 24, 40, 0.16)` | `0 16px 40px rgba(0, 0, 0, 0.6)` |
| `--focus-ring` | `0 0 0 3px rgba(31, 95, 139, 0.35)` | `0 0 0 3px rgba(90, 167, 216, 0.45)` |

Use a 1px border for most surface separation. Cards have the smallest shadow; hovered linked cards and toasts use the medium shadow; menus and dialogs use the large shadow.

## 5. Layout and responsive behavior

### Application shell

- Full-height shell with a left navigation column and a flexible main region.
- Expanded navigation is `232px`; collapsed navigation is `64px`.
- Brand row and workspace toolbar share a `56px` height token. The toolbar can grow when controls wrap.
- Navigation uses an elevated background and a right border. Group headings organize related tasks; utility actions sit at the bottom.
- Navigation links use `8px 10px` padding, a `10px` icon gap, and a `6px` radius. Selection uses primary text on a primary-soft background.
- Standard pages scroll inside the main region, with `28px 32px 48px` padding. Narrow pages are centered with a maximum width of `1080px`.
- Page headers place a title and description on the left and actions on the right, with wrapping and a `16px` gap.

### Page compositions

| Composition | Structure |
| --- | --- |
| Overview | Header → action or workflow cards → recent work / progress |
| Card collection | Auto-fill columns, minimum `260px`, `16px` gaps |
| Editor | Toolbar → flexible canvas + `420px` inspector |
| Configuration and results | `380px` configuration column + flexible results, `20px` gap |
| Reference content | `280px` sticky index + flexible article, `24px` gap |
| Dashboard | KPI grid → chart cards → detailed tables |

Use `minmax(0, 1fr)`, `min-width: 0`, and `min-height: 0` in flexible workspaces so wide content and nested scrolling do not force the shell to expand.

### Existing breakpoints

| Maximum viewport width | Adaptation |
| --- | --- |
| 1100px | Inspector narrows to `340px`; configuration/results layout becomes one column |
| 960px | Two-column home hero becomes one column |
| 900px | Two- and three-column utility grids become one column; reference index moves above content |
| 820px | Sidebar becomes a horizontal, scrollable navigation row; labels and group headings are hidden; page padding becomes `18px 16px 40px`; inspector moves below the canvas |

At the smallest editor breakpoint, canvas and inspector rows are defined as `minmax(320px, 1fr)` and `minmax(280px, 45vh)`. This is a dense workspace layout. **Transfer recommendation:** check the receiving app's smallest supported screen and scrolling behavior instead of assuming these minimum heights fit every phone.

## 6. Component recipes

### Buttons and inputs

| Component | Geometry and treatment |
| --- | --- |
| Default button | `34px` high, `0 12px` padding, `6px` gap and radius, 1px border, elevated fill, weight 550 |
| Small button | `28px` high, `0 8px` padding, 13px text |
| Icon button | Square `34px`; small version `28px` |
| Primary button | Primary fill and border, text-on-primary foreground |
| Secondary button | Default bordered button; hover uses bg-hover and border-strong |
| Ghost button | Transparent fill and border; bg-hover on hover |
| Danger button | Error-colored text with the base button treatment |
| Selected button | Primary-soft fill, primary text and border |
| Input / select | `34px` high, `0 10px` padding, 6px radius, elevated fill, 1px border |
| Small input / select | `28px` high, `0 6px` padding, 13px text |
| Textarea | Auto height, `8px 10px` padding, vertical resize |

Disabled buttons use 50% opacity and a not-allowed cursor. Focused inputs use a primary border and the focus-ring shadow. Form fields stack label, control, and hint with a `4px` gap and `12px` separation between fields. Responsive field rows have `10px` gaps and minimum `120px` columns.

**Transfer recommendation:** give each task group one visually dominant action. Use labels with concrete verbs, such as “Run simulation,” “Import file,” or “Save changes.” Give accent and danger variants explicit hover styles if using them in the receiving app; the current stylesheet lets them inherit the base button hover.

### Cards, lists, and selection

- Standard card: elevated background, 1px border, 10px radius, 18px padding, smallest shadow.
- Card title row: aligned title and utility action, 8px gap, 12px bottom spacing.
- Linked card hover: primary border and medium shadow. No actual translation or scaling is applied.
- Compact rows: small outline icon, label, optional metadata or trailing action; bg-hover signals interaction.
- Selected rows and options: primary-soft background with a primary outline where appropriate.
- Collection preview cards: `140px` preview region separated by a bottom border, followed by `12px 14px` body padding.

### Tabs, chips, and badges

- Tabs sit above a 1px bottom divider. Each tab has `9px 12px` padding, a `6px` icon gap, and weight 550. Selection uses primary text and a 2px bottom border.
- Tab strips scroll horizontally when needed. Inspector tabs are denser: 13px text and `10px 8px` padding.
- Filter chips use `3px 9px` padding, 12px text, a pill radius, and a 1px border. Selection adds primary-soft fill, primary border, and primary text.
- Status badges are `20px` high with `0 7px` padding, 11px text, weight 650, and a pill radius. Semantic variants use matching foreground/soft pairs and transparent borders.

### Feedback and progress

- Callouts use `10px 12px` padding, a 6px radius, an 18px leading icon, and a `10px` content gap. Semantic borders mix the role color with transparency: 30% for informational callouts and 35% for warning, error, and success.
- Validation rows use a 3px inset severity stripe, a severity icon, a short title, and expandable explanatory content. Explanations connect the problem to its consequence and a possible fix.
- Empty states are centered with `36px 16px` padding, a muted icon, a short heading, and helpful next-step content.
- Progress tracks are `8px` high, pill-shaped, and sunken; fills use primary color.
- Toasts stack at the bottom right, `16px` from the edges, with an `8px` gap. Each has `10px 14px` padding, 6px radius, medium shadow, and a 4px primary or semantic left border. Current widths are `260–420px`.

### Tables and metrics

- Wrap tables in a horizontally scrollable container with a 1px border and 6px radius.
- Body text is 13px; sticky header text is 12px, weight 600, muted, on bg-subtle.
- Cells use `7px 10px` padding and horizontal separators. Hover highlights the entire row.
- Right-align numeric columns and use tabular numerals. Keep units visible and number formatting consistent.
- KPI grids use minimum `170px` columns and `12px` gaps. Tiles use `12px 14px` padding, 10px radius, and a 1px border.
- KPI hierarchy: 12px muted label → 22px bold value → 11px subtle supporting detail. Outcome deltas use semantic colors and weight 650.

### Dialogs and menus

- Dialog backdrop: `rgba(10, 16, 24, 0.5)`, centered layout, `24px` viewport padding.
- Dialog: elevated fill, 1px border, 14px radius, large shadow, width `min(960px, 100%)`, maximum height `calc(100vh - 48px)`.
- Header: `14px 18px` padding and bottom divider. Body: 18px padding and vertical scrolling. Footer: `12px 18px` padding, top divider, actions aligned right with an 8px gap.
- Menus: minimum `230px` width, 6px radius, large shadow, 4px outer padding, 4px below their trigger. Items use `7px 10px` padding.
- Existing layer order: watermark 10, canvas controls 15, canvas overlay 20, menus 30, dialogs 50, toasts 60, skip link 100.

## 7. Icons and brand treatment

Use Lucide outline icons for application actions and navigation. Common sizes are 16px in buttons, 18px in navigation and callouts, and 13–14px in small inline actions. Keep icons aligned to text and usually inherit the surrounding foreground color.

The navigation brand uses a `30px` primary-colored square with an `8px` radius, containing a `20px` monochrome mark. The wordmark is 15px and its supporting line is 11px. The BPMN mark uses simple connected geometric forms with 2px strokes.

When transferring the language, retain the compact mark/wordmark proportions and outline-icon treatment while replacing the BPMN symbol with a mark appropriate to the new product. Domain notation icons belong inside domain content, separate from navigation icons.

## 8. Data visualization

Charts have a separate categorical palette. Do not use category colors to imply success, warning, or failure.

| Token | Light | Dark |
| --- | --- | --- |
| `--chart-1` | `#2a78d6` | `#3987e5` |
| `--chart-2` | `#eb6834` | `#d95926` |
| `--chart-3` | `#1baf7a` | `#199e70` |
| `--chart-grid` | `#e1e0d9` | `#2c2c2a` |
| `--chart-axis` | `#c3c2b7` | `#383835` |
| `--chart-muted` | `#898781` | `#898781` |
| `--chart-surface` | `#ffffff` | `#171e27` |

Additional status-scale tokens stay the same in both themes: `--status-good: #0ca30c`, `--status-warning: #fab219`, `--status-serious: #ec835a`, and `--status-critical: #d03b3b`.

- Place charts in bordered cards with a title, concise subtitle including units, and a legend for multiple series.
- Use one value axis per chart, light grid lines, no tick marks, and 11px axis text; categorical labels commonly use 12px.
- Use horizontal bars for named categories. Bars generally have a maximum thickness of 24px; paired bars use 18px. Round exposed ends by 4px.
- Use 2px lines. Area fills use 10% opacity. Step curves represent discrete changes; continuous trends may use smooth lines.
- Tooltips match the card palette with a 6px radius, `8px 10px` padding, 12px text, and medium shadow.
- Present a table view alongside chart-based analysis. Labels, units, legends, and numeric values carry meaning as well as color.
- Resolve chart colors from theme tokens and refresh them when the theme changes. Keep a series' identity consistent across related views.

## 9. Embedded workspace surfaces

These tokens are specific to the diagram workspace but can inform an editor, map, or other visual tool in the receiving app:

| Token | Light | Dark |
| --- | --- | --- |
| `--canvas-bg` | `#ffffff` | `#141a22` |
| `--bpmn-stroke` | `#22242a` | `#d7dee8` |
| `--bpmn-fill` | `#ffffff` | `#1b232d` |
| `--bpmn-label` | `#22242a` | `#e6ebf1` |

Keep the canvas visually quiet and place dense explanations in the adjacent inspector. Use orange outlines to draw attention to a selected explanation or issue location. Compact embedded viewers have a 1px border, 6px radius, and a typical height of 260px, or 360px for the tall variant.

BPMN Studio themes default diagram colors while preserving user-assigned colors. Its third-party controls receive matching surface, text, border, and focus values. Transfer this principle to embedded tools instead of recoloring every element indiscriminately. The BPMN-specific selectors and renderer color sentinels are implementation details, not required parts of the general design language.

## 10. Theme, motion, and accessibility

The theme model supports `light`, `dark`, and `system`. The resolved theme is applied as `data-theme="light"` or `data-theme="dark"` on the root element. CSS also supplies a system-dark fallback when an explicit light theme is absent. The visible toggle switches between light and dark; the theme layer stores the preference and observes system changes.

Motion is brief and functional:

| Interaction | Existing timing |
| --- | --- |
| Button background and border | 120ms |
| Linked-card border and shadow | 120ms |
| Toast appearance | 180ms ease-out, fading in from 8px below |
| Progress width | 250ms |
| Loading spinner | 1s linear, repeating |

The app includes a visible keyboard focus treatment, a skip-to-content link, semantic navigation, labeled dialog and progress primitives, and selected-state attributes on tabs. Dialogs focus themselves when opened, close on Escape, and restore previous focus when closed.

**Transfer recommendations:** preserve these foundations and complete interaction behavior in the receiving app. The existing shared dialog does not implement focus trapping, tabs do not implement arrow-key navigation, and the styles do not include a reduced-motion override. Add those behaviors where applicable. Give every icon-only control an accessible name, including when responsive styles hide its text. Review text contrast, touch hit areas, toast widths, zoom/reflow, and both themes in the destination layout; this guide is a visual specification, not an accessibility certification.

## 11. Content and voice

Use direct, instructional language. Prefer a clear action and an explanation of what happens next. Keep headings short, descriptions informative, and implementation terminology out of ordinary task flows.

- Actions: “Open the modeler,” “Continue learning,” “Run simulation.”
- Empty states: state what is missing, then give a useful next step.
- Errors: identify the problem, explain the consequence, and offer a fix.
- Results: show the value, its unit, and relevant context or uncertainty.
- Learning feedback: make progress and correctness understandable through words and icons as well as color.

Transfer the tone and hierarchy while replacing BPMN-specific labels with the receiving product's vocabulary.

## 12. Implementation tokens and explicit additions

### 12.1 Complete inherited CSS values

Put these in a central theme file, proposed `src/styles/tokens.css`. Values below are copied from the supplied tables, including the intentionally warm chart grid palette. Keep the original `--bpmn-*` names only as compatibility/provenance aliases if useful; Markov components should consume the `--markov-*` aliases in §12.2. There is no BPMN renderer dependency.

Apply the resolved theme to `document.documentElement` before the first visible paint. Store preference separately as `light`, `dark`, or `system`. A system preference follows media-query changes; a manual preference does not. Expose all three in Settings and let the compact toggle switch explicit light/dark. CSS below preserves the supplied system-dark fallback in the absence of explicit light.

```css
:root, :root[data-theme="light"] {
  color-scheme: light;
  --bg: #f4f6f9;
  --bg-elevated: #ffffff;
  --bg-subtle: #eef1f5;
  --bg-sunken: #e6eaf0;
  --bg-hover: #e9eef5;
  --border: #d6dce5;
  --border-strong: #b7c1cf;
  --text: #17202c;
  --text-muted: #4b5867;
  --text-subtle: #6b7787;
  --text-on-primary: #ffffff;
  --primary: #1f5f8b;
  --primary-hover: #184d72;
  --primary-soft: #e3eef7;
  --primary-strong: #123b59;
  --accent: #d9822b;
  --accent-soft: #fbeedd;
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow: 0 2px 8px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow-lg: 0 12px 32px rgba(16, 24, 40, 0.16);
  --focus-ring: 0 0 0 3px rgba(31, 95, 139, 0.35);
  --chart-1: #2a78d6;
  --chart-2: #eb6834;
  --chart-3: #1baf7a;
  --chart-grid: #e1e0d9;
  --chart-axis: #c3c2b7;
  --chart-muted: #898781;
  --chart-surface: #ffffff;
  --canvas-bg: #ffffff;
  --bpmn-stroke: #22242a;
  --bpmn-fill: #ffffff;
  --bpmn-label: #22242a;
  --error: #c0392b;
  --error-soft: #fbe9e7;
  --warning: #b7791f;
  --warning-soft: #fdf3dc;
  --recommendation: #2b6cb0;
  --recommendation-soft: #e6f0fa;
  --info: #5a6779;
  --info-soft: #eef1f5;
  --success: #2f855a;
  --success-soft: #e3f4ea;
  --font-sans: 'Inter', 'IBM Plex Sans', system-ui, -apple-system,
    'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace,
    SFMono-Regular, Menlo, monospace;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --status-good: #0ca30c;
  --status-warning: #fab219;
  --status-serious: #ec835a;
  --status-critical: #d03b3b;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f141b;
  --bg-elevated: #171e27;
  --bg-subtle: #1c2430;
  --bg-sunken: #121821;
  --bg-hover: #233042;
  --border: #2b3645;
  --border-strong: #3b4a5e;
  --text: #e6ebf1;
  --text-muted: #b2bdcb;
  --text-subtle: #8a97a8;
  --text-on-primary: #0b1520;
  --primary: #5aa7d8;
  --primary-hover: #7ab9e3;
  --primary-soft: #16314a;
  --primary-strong: #a8d3ef;
  --accent: #f0a457;
  --accent-soft: #3a2a17;
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.6);
  --focus-ring: 0 0 0 3px rgba(90, 167, 216, 0.45);
  --chart-1: #3987e5;
  --chart-2: #d95926;
  --chart-3: #199e70;
  --chart-grid: #2c2c2a;
  --chart-axis: #383835;
  --chart-muted: #898781;
  --chart-surface: #171e27;
  --canvas-bg: #141a22;
  --bpmn-stroke: #d7dee8;
  --bpmn-fill: #1b232d;
  --bpmn-label: #e6ebf1;
  --error: #f2776a;
  --error-soft: #3b1d1a;
  --warning: #e8b45a;
  --warning-soft: #3a2d14;
  --recommendation: #79b2ec;
  --recommendation-soft: #172a40;
  --info: #a3afbf;
  --info-soft: #1f2833;
  --success: #6fcf97;
  --success-soft: #16301f;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0f141b;
    --bg-elevated: #171e27;
    --bg-subtle: #1c2430;
    --bg-sunken: #121821;
    --bg-hover: #233042;
    --border: #2b3645;
    --border-strong: #3b4a5e;
    --text: #e6ebf1;
    --text-muted: #b2bdcb;
    --text-subtle: #8a97a8;
    --text-on-primary: #0b1520;
    --primary: #5aa7d8;
    --primary-hover: #7ab9e3;
    --primary-soft: #16314a;
    --primary-strong: #a8d3ef;
    --accent: #f0a457;
    --accent-soft: #3a2a17;
    --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
    --shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
    --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.6);
    --focus-ring: 0 0 0 3px rgba(90, 167, 216, 0.45);
    --chart-1: #3987e5;
    --chart-2: #d95926;
    --chart-3: #199e70;
    --chart-grid: #2c2c2a;
    --chart-axis: #383835;
    --chart-muted: #898781;
    --chart-surface: #171e27;
    --canvas-bg: #141a22;
    --bpmn-stroke: #d7dee8;
    --bpmn-fill: #1b232d;
    --bpmn-label: #e6ebf1;
    --error: #f2776a;
    --error-soft: #3b1d1a;
    --warning: #e8b45a;
    --warning-soft: #3a2d14;
    --recommendation: #79b2ec;
    --recommendation-soft: #172a40;
    --info: #a3afbf;
    --info-soft: #1f2833;
    --success: #6fcf97;
    --success-soft: #16301f;
  }
}
```

### 12.2 New aliases for Markov components

The following names are **new destination tokens**. Their values either alias exact inherited roles or expose source dimensions that were literal CSS values. Do not describe the spacing-variable names, layout-variable names, or Markov aliases as names found in the source.

```css
:root {
  --markov-stroke: var(--bpmn-stroke);
  --markov-fill: var(--bpmn-fill);
  --markov-label: var(--bpmn-label);
  --markov-selected: var(--primary);
  --markov-selected-soft: var(--primary-soft);
  --markov-active: var(--accent);
  --markov-active-soft: var(--accent-soft);
  --markov-invalid: var(--error);
  --markov-invalid-soft: var(--error-soft);
  --markov-focus: var(--primary);
  --markov-accent-foreground: #1d1205; /* Exact source accent foreground. */

  --space-2: 2px;
  --space-4: 4px;
  --space-6: 6px;
  --space-8: 8px;
  --space-10: 10px;
  --space-12: 12px;
  --space-14: 14px;
  --space-16: 16px;
  --space-18: 18px;
  --space-20: 20px;
  --space-24: 24px;
  --space-28: 28px;
  --space-32: 32px;
  --space-40: 40px;
  --space-48: 48px;

  --nav-width: 232px;
  --nav-width-collapsed: 64px;
  --toolbar-height: 56px;
  --inspector-width: 420px;
  --config-width: 380px;
  --reference-index-width: 280px;
  --content-max-width: 1080px;
  --control-height: 34px;
  --control-height-small: 28px;
  --radius-local: 4px;
  --radius-pill: 999px;
  --layer-watermark: 10;
  --layer-canvas-controls: 15;
  --layer-canvas-overlay: 20;
  --layer-menu: 30;
  --layer-dialog: 50;
  --layer-toast: 60;
  --layer-skip-link: 100;
}
```

Implement source responsive rules at `max-width: 1100px`, `960px`, `900px`, and `820px`; CSS custom properties cannot be used directly as media-query conditions without a build transformation. At 1100px set `--inspector-width: 340px`. At 820px switch to stacked workspace layout rather than retaining a fixed-width inspector.

### 12.3 More than three state categories

The supplied style defines only three categorical series. The existing Doomscroll model has seven states and users can create more. Keep `--chart-1` through `--chart-3` unchanged. The following values are **proposed Markov-only extensions**, not transferred source values:

| New token | Light | Dark |
| --- | --- | --- |
| `--chart-4` | `#8054b3` | `#b38cde` |
| `--chart-5` | `#b34f83` | `#e28bb8` |
| `--chart-6` | `#167f88` | `#62bdc5` |
| `--chart-7` | `#8f6a22` | `#d5b366` |

Define these in the same light/dark/fallback theme layer. Assign categories by persistent state ID, not label, sort position, probability rank, or current selection. Preserve explicit user colors. For additional states, combine the seven colors with stable dash patterns, marker shapes, and text labels; offer filtering and small multiples. Never imply unlimited uniquely distinguishable colors. Review these extensions with color-vision simulations and actual chart backgrounds before release.

Category colors decorate markers, line swatches, or a small state strip; ordinary labels use `--text`/`--text-muted`. Do not use categorical fills as guaranteed text backgrounds or encode success/failure by a state's category. Absorbing, transient, recurrent, and periodic are mathematical properties, not success/error statuses.

### 12.4 Source fidelity and accessibility adaptations

Keep all inherited raw values even where a specific pairing needs better contrast. Use component-level semantic aliases or different foreground roles, and document them. For example, warning prose can use `--text` on `--warning-soft`, with a warning icon and label; do not assume the warning foreground passes for small text. Chart axis numbers may need `--text-muted` instead of `--chart-muted` after contrast review. This is an explicit accessibility adaptation, not an undocumented palette replacement.

Self-host a licensed variable Inter font covering the required 400/550/600/650/700 weights and a licensed JetBrains Mono or IBM Plex Mono family if consistent cross-machine typography is required. Verify available font axes and avoid silently synthesizing 650 from a mismatched static font. Include licenses and `font-display: swap`; preserve the exact fallback stacks. The source did not load custom font files, so self-hosting is a new implementation choice.

## 13. Markov identity, shell, and page compositions

### 13.1 Brand and navigation

Use **Markov Chain Simulator** as the product name, with an optional short supporting line **Model · Simulate · Understand**. At narrow navigation widths the wordmark may truncate or disappear, but the full accessible name remains.

Replace the BPMN brand symbol with a small connected-state mark: three circles joined by directed links, with one return arc. Use the exact 30px primary square / 8px radius / 20px mark proportions and 2px monochrome strokes. Create this as a simple SVG/component, not a decorative image. Avoid emoji as primary navigation or status icons; the README's emoji headings do not define the new UI style.

Use Lucide outline icons at source sizes. Suitable concepts include a network for Modeler, Play for Simulation, Flask for Experiments, Chart for Analysis, comparison arrows for Compare, a book for Lessons, and a target for Challenges. Verify the actual exported icon names against the installed Lucide version. Always provide text or accessible names.

Navigation groups and destinations follow `PLAN.md` §3. On desktop, maintain expanded/collapsed navigation and lower utility actions. At 820px, transfer the horizontal scrollable icon navigation, hiding visual labels/group headings while preserving accessible labels, active indication, focus visibility, and tooltips usable by keyboard. A skip-to-content link appears above it on focus.

### 13.2 Modeler layout

```text
┌──────────────┬──────────────────────────────────────────────────────┐
│ Navigation   │ Model name · saved status      Undo  Redo  More      │
│ 232 / 64 px  │ Add state   Validate   Fit     Run simulation        │
│              ├───────────────────────────────┬──────────────────────┤
│              │                               │ Matrix | State       │
│              │ React Flow canvas             │ Validate | Sequence  │
│              │ draggable states              │ Explain              │
│              │ floating directed arcs        │                      │
│              │                               │ 420px inspector      │
│              │ zoom / fit, compact legend     │ (340px at ≤1100px)   │
│              ├───────────────────────────────┴──────────────────────┤
│              │ Optional exact distribution / trace panel           │
└──────────────┴──────────────────────────────────────────────────────┘
```

The source toolbar minimum is 56px; permit wrapping into extra height. One primary action per task group: typically **Run simulation** in the workspace; **Save** need not dominate when autosave works. Keep **+ Add State** recognizable and **New Model** discoverable in the project actions. Do not add a large hero above the active canvas.

The graph should own available space. Use a quiet `--canvas-bg`; place formulas and dense descriptions in the inspector. A small nonintrusive status strip can show state/transition counts, validity, and current simulation step. Avoid a permanent floating panel over the center of the graph. Put zoom/fit controls in the canvas-control layer with matching surface, border, focus, and icon treatment.

At ≤820px, put canvas above inspector with the original `minmax(320px,1fr)` / `minmax(280px,45vh)` target proportions where the viewport allows. On short phones, switch to document scrolling or a clearly labeled Canvas/Inspector view switch rather than making an unreachable nested panel. This is an explicit Markov adaptation for usability. The page itself must not overflow horizontally; graph pan and matrix horizontal scrolling are intentional bounded regions.

### 13.3 Other destinations

| Destination | Composition and dominant action |
| --- | --- |
| Overview | Modest 32px hero, Continue model, create/open actions, recent work, learning progress; source card proportions |
| Examples | 260px minimum cards, 140px graph preview, title/assumptions/difficulty, **Open example** |
| Simulation | Toolbar + graph + 420px inspector or trace; exact/sample mode selector; **Play** or **Step** |
| Experiments | 380px configuration column + flexible results, 20px gap; single column at ≤1100px; **Run experiment** |
| Analysis | Model/assumptions header → mathematical status → KPI cards → charts → tables/explanations |
| Compare | Baseline/alternative selectors → assumption differences → paired KPI/table/chart sections; **Compare** |
| Lessons | 280px index + article, 24px gap; 76ch explanation measure; inline miniature graph and exercise |
| Challenges | Objective and constraints → editable model → feedback and progressive hints; **Check answer** |
| Settings | Narrow centered sections for theme, display precision, data export/recovery, reset; restrained danger actions |

Avoid placeholder dashboard numbers. When no result exists, show a useful empty state with configuration guidance. Preserve all four existing example names. A scenario subtitle can clarify scientific assumptions without replacing the existing title.

## 14. Domain component specifications

### 14.1 States and directed arcs

Existing node geometry and floating-edge algorithms take priority over a generic graph redesign. Audit and preserve the eye-shaped separation of A→B and B→A, edge attachment during dragging, and center-drag connection gesture. Reuse React Flow custom nodes/edges if they already implement these correctly.

New geometric defaults, to use only if the current graph has no stronger established sizing:

- Circular state body: 64px nominal diameter, 2px default outline, theme fill and label tokens. Keep a short label inside; show the full name in the inspector and accessible name. Long labels may wrap to two lines or use a separate external label; do not expand nodes unpredictably while typing.
- Render mathematical edges with 1.5–2px strokes and direction arrowheads; use 2px for primary graph readability. Selectable hit paths may be at least 12px wide and visually transparent without changing the visible curve.
- Probability labels use 12px text with tabular numerals, an opaque theme surface, 2px 4px padding, and 4px radius. Position A→B and B→A labels independently to prevent overlap. Label zero only in the matrix or an explicit draft edge.
- Self-loops must have a distinct visible arc, arrowhead, and label. Their animation/selection path is the same path users see.
- A selected node/edge uses blue with a visible outline; keyboard focus adds a separate offset ring. Active simulation uses an orange ring/token. Selected-explanation locations may use the source's orange outline, but a labeled explanation panel distinguishes them from a running token.
- Invalid states/rows use an error badge and linked issue, not a solid red recoloring of the entire graph. User-assigned colors remain intact where they do not hide required status.
- Initial-state marker uses an explicit start arrow or small “Start” label. A mixed initial distribution shows a separate distribution control, not multiple “current state” tokens.
- Absorbing states use a compact **Absorbing** label or double-outline marker with a legend; do not automatically color them green. Recurrent class membership is an optional labeled overlay.

All styles must support normal, hover, selected, focused, dragging, connecting, invalid, active simulation, unreachable-from-start, and disabled states. Unreachable states remain readable; do not reduce them below usable contrast. Error/selection/active indicators can coexist via distinct outlines and badges.

### 14.2 Transition matrix and initial distribution

Use the source table frame, sticky headers, compact type, borders, padding, and tabular numerals. Add sticky row labels and a corner **From ↓ / To →** label. The row-total column remains visible when practical. A selected source row and destination column use restrained primary-soft emphasis; the active cell has a clear primary border and focus treatment.

Prefer a semantic HTML table with labeled inputs. If using an ARIA grid for large matrices, implement its full keyboard behavior and test it; do not add `role="grid"` merely for styling. Accessible names identify source, destination, and probability. Editing supports Enter commit, Escape cancel, and predictable Tab movement. Optional arrow-key navigation applies only in navigation mode and must not steal caret movement inside an active text input.

| Cell/row state | Appearance | Required text/behavior |
| --- | --- | --- |
| Valid | Elevated fill, normal text | Full stored value on edit; formatted value otherwise |
| Zero probability | Normal numeric zero, optionally muted | Still editable; zero is distinct from an empty draft |
| Dirty/incomplete | Focus border and hint | Keep typed string, explain incomplete entry; no forced zero |
| Invalid value | Error border, error icon, linked text | “Enter a probability from 0 to 1.” |
| Invalid row total | Error row-total badge and affected-row cue | “Total 1.20 — reduce this row by 0.20.” |
| Near-one numeric adjustment | Neutral numerical-detail indicator | Diagnostic explains floating-point compilation adjustment |
| Selected edge | Primary-soft cell and primary outline | Matches graph edge and inspector |
| Read-only snapshot | Subtle surface and visible lock label | Values remain selectable/copyable; explain why editing is locked |

Row total display must not round an invalid row to a seemingly valid “1.0000”; show enough digits or the signed discrepancy. Use words plus icons, never color alone. Offer Normalize row / Fill remainder / Make absorbing in contextual actions according to `PLAN.md`; no automatic normalization through a visual blur handler.

Initial distribution is a separate labeled vector/table using the same state order, with **Single starting state** and **Custom distribution** modes. Display its sum and errors independently. The matrix and initial distribution must never share an ambiguous “probability total” badge.

### 14.3 Sequence probability calculator

Preserve the existing state buttons and click-to-build interaction. Render the path as state chips with arrow separators, each having an accessible remove action. Provide Undo last state / Clear sequence. A keyboard user can add every state and remove any selected step.

Show clearly labeled **Joint probability** and **Given starting state** modes. Display the initial factor when appropriate, one factor per transition, final value, and optional log probability. Keep formulas in an overflow-contained region or wrap factors without losing order. Long paths must not widen the inspector. Highlight the first zero-probability transition with explanation.

Use a calm result card, not a giant celebratory number. Add the subtitle “Calculated from the model” and numerical precision details where needed. Avoid calling a positive underflowed value impossible. A one-state path shows the correct zero-transition explanation.

### 14.4 Simulation controls and trace

Place Play/Pause, Step, Stop, Reset, speed, seed, and horizon in grouped controls. Use source 34px controls and 28px compact variants where necessary. Play/Pause occupies a stable position and width to avoid toolbar shifts. In a running state, show a small accent badge **Running · step 24**; use dark `#1d1205` text on solid accent backgrounds.

A status row distinguishes **Ready**, **Running**, **Paused**, **Stopped**, **Completed**, and **Cancelled**. Disable controls only when their action is unavailable and provide an explanation. Speed affects presentation only. A reduced-motion setting is not a simulation-speed setting.

Trace tables use step index, from state, to state, and probability. Current-row highlighting is restrained. Auto-scroll follows playback only until the user scrolls away; provide **Follow current step**. Announce run state changes accessibly, not every animation frame or every batch iteration. Explanations can show the selected random interval without implying a draw predicts future transitions.

### 14.5 Analysis cards and mathematical status

Before showing stationary or absorption results, display an explanatory status in plain language:

- “One stationary distribution. This chain is aperiodic and irreducible.”
- “Two closed classes. Long-run outcomes depend on the starting distribution.”
- “Stationary distribution exists; convergence is not guaranteed.”
- “The target is not reached with probability 1. Unconditional expected time is infinite.”
- “Calculation could not meet the numerical accuracy target.”

A valid periodic/reducible chain uses neutral or recommendation treatment; it is not an error. Infinite, undefined, unsupported, not yet computed, and failed are distinct display states. Use visible text such as **Infinite**, **Not defined**, **Unsupported**, or **Run analysis**, not an unexplained dash. Numerical details can live in a disclosure, but never hide a material warning there.

KPI cards use source geometry and 22px values. Label probability, steps, steps², visits, or reward units. A stationary vector is a distribution table/chart, not a single KPI. Show analytic/sampled method badges and provenance nearby.

### 14.6 Charts, uncertainty, and comparisons

Retain the exact chart palette and recipes in §8. For Markov time series:

- Use discrete step indices and step curves or explicitly connected point markers; no smoothed curves that imply continuous interpolation or invent overshoots.
- Probability axes normally span `[0,1]` or `[0%,100%]`. Label intentional zooming clearly. Do not auto-scale two compared probability charts differently.
- Exact distribution and empirical estimates use line/marker differences in addition to legend wording. Avoid implying that one animated trajectory is a probability distribution.
- A confidence band uses low-opacity categorical fill with a label stating confidence level, method, sample size, and pointwise scope. Do not let it cover the analytic line or grid excessively.
- First-hit histograms include a separate censored count/card. Never plot censored trajectories as if they hit at the horizon.
- Show units and step meaning in chart subtitles. Tooltips identify state, step, method, value, and interval where applicable; provide keyboard-accessible table equivalents.
- For >7 states, allow filtering, aggregation only with explicit semantics, or small multiples. Hiding a series never changes computation.
- Comparison bars use paired 18px bars and common axes. Probability deltas are percentage points; relative-change values are labeled separately. Good/bad colors require a stated goal, with arrows and text.
- Display changed model assumptions before comparison verdicts. A lower probability may be good for Ruin and bad for Rich; semantic color follows the metric objective.

### 14.7 Educational content and challenge feedback

Use 20px lesson section headings, 14px prose, a 76ch maximum measure, and miniature graphs at 260px or 360px source heights. Place the common misconception next to the interactive example. A lesson stepper may use pill indicators, but primary buttons retain 6px radius.

Challenge feedback has three explicit parts: what is correct, what needs attention and why, and a next action or hint. Use success/error colors only for actual assessment results. Hints are numbered and progressive; their button remains available without restarting the challenge. Preserve unsaved model work while exploring theory.

Every visual teaching example needs a textual description and inspectable numbers. Formula rendering must include accessible text/MathML where supported; do not render key mathematics solely into an image or canvas.

## 15. Accessibility, motion, and interaction completion

The source supplies useful primitives but explicitly does not guarantee focus trapping, arrow-key tabs, or reduced-motion overrides. All three are required additions in Markov.

### 15.1 Keyboard and assistive technology

- Use semantic landmarks, one main content region, a skip link, meaningful headings, and a visible focus indicator. Focus should remain identifiable over both canvas and tinted panels.
- Modal dialogs trap focus, name themselves, restore trigger focus, and close on Escape when safe. Confirm destructive actions with specific object names; preserve edits if dismissed. Make underlying content inert while modal.
- Tabs use correct roles, selected state, associated panels, roving tab index, and arrow/Home/End navigation. Decide and document automatic versus manual activation; use manual activation when panels trigger expensive work.
- Menus support keyboard opening, arrows, Home/End, Escape, and focus restoration. Tooltips appear on hover and focus and never contain the sole copy of essential instructions.
- Provide explicit **Add transition** controls and editable state lists so graph dragging is never the only method. Double-click rename has an Enter/menu alternative. Provide keyboard pan/zoom instructions without intercepting text-field keys.
- Destructive keyboard shortcuts do not operate while typing. Undo/redo respects platform modifier conventions and avoids overriding ordinary text editing inside inputs.
- Every icon-only control has an accessible name, including responsive labels hidden at 820px. Do not rely on a `title` attribute alone.
- Associate input errors with fields and use `aria-invalid`. Use polite live regions for saved/run/validation summaries, assertive announcements only for urgent failures. Do not flood announcements with animated steps.
- Chart tables and matrix values remain available to screen readers. A virtualized grid must preserve correct row/column counts and discoverability, not pretend only visible rows exist.

### 15.2 Contrast, targets, reflow

Target WCAG 2.2 AA behavior and verify it; the copied palette is not an accessibility certification. Check ordinary text at 4.5:1, large text at 3:1, and meaningful controls/graphics at 3:1 against adjacent colors. Review actual composite backgrounds and all theme states. Category colors and the inherited status scale are not guaranteed safe for small text.

Keep source visual density on desktop. On coarse pointers use at least 44px control hit areas as a product usability target, with enough spacing to prevent overlaps; 28px small controls must not become tiny touch targets. Enlarged hit boxes must not cover neighboring actions. Matrix cells may scroll within their region, and graph controls need equivalent form actions.

At 320px content width or 400% zoom, avoid page-level horizontal scrolling for ordinary content. Complex matrices/graphs may scroll within labeled bounded regions. At 200% text zoom preserve labels, dialogs, errors, and controls. Toasts use `width: min(420px, calc(100vw - 32px))` and may be narrower than the source's 260px minimum on small screens; this is a deliberate responsive adaptation.

### 15.3 Motion and focus styles

Retain the source's 120ms control/card transitions, 180ms toast entrance from 8px below, 250ms progress width, and 1s spinner. Do not animate linked-card scale/translation. The animated Markov token uses the exact visible edge path; its speed is separate from these UI transition timings.

Suggested required additions:

```css
:where(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--markov-focus);
  outline-offset: 2px;
  box-shadow: var(--focus-ring);
}

@media (prefers-reduced-motion: reduce) {
  .button, .linked-card, .toast, .progress-fill {
    transition: none;
    animation: none;
  }
  .simulation-token, .loading-spinner {
    animation: none;
  }
}
```

Component class names are proposed. The motion preference must also reach JavaScript/React Flow animation code; CSS alone cannot cancel scripted travel. Replace token travel with instantaneous state/edge highlights, preserve Step and Pause, and provide a static loading label when removing spinner motion. Avoid opacity pulses or flashes as an alternative.

## 16. Content, empty states, and recovery messages

Use the source's instructional tone. Explain the next useful action and the mathematical consequence. Prefer **state**, **transition**, **starting distribution**, **step**, **path**, **sample trajectory**, **exact distribution**, **experiment**, and **closed class**. Define specialized vocabulary in context.

| Situation | Recommended copy |
| --- | --- |
| Empty canvas | “Create your first state, or open an example to explore a working model.” |
| Invalid row | “Transitions from Sunny total 1.20. Reduce this row by 0.20 before running.” |
| No initial distribution | “Choose a starting state or enter a distribution that totals 1.” |
| Results from prior model | “These results use an earlier model version. Run again to analyze your changes.” |
| Nonunique stationary result | “This model has more than one closed class. Explore each class and the outcome weights for your start.” |
| Finite-horizon censoring | “250 of 1,000 trajectories did not reach the target within 100 steps.” |
| Numerical failure | “This calculation could not meet the accuracy target. Your model is saved; inspect numerical details or try a smaller analysis.” |
| Autosave failure | “Your latest edits could not be saved on this device. Download a project file to keep them.” |
| Unsupported import version | “This project uses a newer file format. Open it in a compatible app version.” |
| Comparison baseline zero | “Relative change is not defined because the baseline is zero. Absolute change is shown.” |

Do not use “steady state reached” based solely on one simulated trace, “never” because no rare event was sampled, “exact” for Monte Carlo, “absorbing” for every recurrent class, or “SIR epidemic forecast” for an illustrative fixed three-state model. Respect the precise definitions in `PLAN.md`.

Errors are inline near their cause and summarized where helpful. Toasts confirm transient actions; they must not be the only record of a validation error or failed save. Loading states should say what is being computed and offer cancellation for expensive work. Avoid displaying stale numerical cards as current behind a spinner.

## 17. Implementation sequence and destination source map

Follow `PLAN.md` phases, with this design order:

1. Audit current CSS and graph customizations; capture baseline screenshots for all preserved features.
2. Add central inherited tokens and Markov aliases. Resolve theme before paint and theme third-party surfaces.
3. Build shared primitives with every required state: buttons, fields, cards, tabs, badges, callouts, tables, dialogs, menus, progress, toasts.
4. Apply the shell and one complete Weather modeler slice at desktop density. Verify graph/matrix linkage and curved-edge geometry before expanding.
5. Adapt matrix editing, sequence calculator, simulation controls, and analysis cards. Keep probabilities legible throughout.
6. Apply the same components to lessons, experiments, and comparison pages; avoid one-off color/style systems.
7. Complete responsive behavior, keyboard interactions, motion preferences, and contrast adaptations; capture both themes and document exceptions.

| Proposed destination | Responsibility |
| --- | --- |
| `src/styles/tokens.css` | Exact inherited values, Markov aliases, additional categorical palette |
| `src/styles/global.css` | Reset, typography, shell, focus, common spacing |
| `src/styles/components.css` | Shared controls, surfaces, tabs, feedback, dialogs, tables |
| `src/styles/flow-theme.css` | React Flow controls, canvas, nodes, arcs, labels, overlays |
| `src/styles/features.css` | Modeler, learning, experiments, analysis, comparison layouts |
| `src/components/` | Accessible shared interaction primitives |
| `src/app/AppShell.tsx` | Navigation, collapse/mobile behavior, brand, skip link |
| `src/app/theme.tsx` | Preference, system resolution, persistence, subscription |
| `src/components/BrandMark.tsx` | Connected-state product mark |
| `src/features/analysis/chartTheme.ts` | Theme-resolved chart colors, stable state styling |
| `src/main.tsx` | Vendor styles first; tokens/global/components; Flow overrides; feature styles |

Map these responsibilities onto current repository files instead of moving everything solely to match the suggested names. Do not import BPMN CSS selectors or renderer-specific sentinels. Theme React Flow's actual classes/API as supported by the installed version.

## 18. Design acceptance and handoff checklist

### 18.1 Exact transfer audit

- [ ] All 42 theme-dependent inherited token pairs in §12.1 match the supplied source tables, including semantic, chart, canvas, shadow, and focus values.
- [ ] Exact font stacks, radii 6/10/14px, 4px local and 999px pill shapes, unchanged status-scale colors, and accent foreground `#1d1205` are retained.
- [ ] Type sizes/weights/tracking/line heights in §3 are implemented; tabular numerals align values; long prose respects 76ch/72ch measures.
- [ ] Shell dimensions 232/64/56px, inspector 420→340px, configuration 380px, reference index 280px, page maximum 1080px, and source breakpoints are honored or locally documented for accessibility.
- [ ] Source component spacing, borders, shadows, 34/28px controls, 20px badges, 8px progress tracks, 140px previews, 260/360px embedded viewers, and source layer order are consistent.
- [ ] Markov-only alias names, palette extensions, geometry defaults, and accessibility changes are labeled as additions rather than claimed source values.
- [ ] No glass effects, decorative gradients, oversized marketing treatment, heavy universal shadows, or pill-shaped primary buttons remain in the main workspace.

### 18.2 Visual and interaction matrix

Test each applicable row in light and dark themes. Include normal, hover, selected, focus, disabled, invalid, empty, loading, saved/failed, and running/paused states.

| Surface | Required cases |
| --- | --- |
| Shell | Expanded/collapsed nav; mobile nav; wrapped toolbar; long product/model title |
| Graph | Weather; seven-state Doomscroll; bidirectional arcs; self-loops; long names; many states; mixed selected/active/error states |
| Matrix | Valid/invalid totals; incomplete text; tiny positive values; large model; keyboard focus; sticky headings |
| Calculators | Empty path; one-state path; impossible path; underflow; joint/conditional mode |
| Simulation | Initial state; running; paused; completed; reset/replay; reduced motion; long trace |
| Analysis | Unique/nonunique stationary; periodic; absorbing; unreachable target; infinite mean; numerical failure |
| Experiments | Empty results; progress; cancelled partial run; zero events; intervals; censored trajectories |
| Comparison | Mapped/unmapped states; differing assumptions; zero/infinite baselines; metric-specific direction |
| Learning | Long explanation; formula; keyboard demonstration; hints; correct/incorrect feedback; saved progress |
| Recovery | Save failure; import errors; unsupported schema; conflict; destructive confirmation |

Viewport checks: 1440px desktop; exact 1100/960/900/820px thresholds and just above/below them; 390px phone; 320px reflow; short landscape viewport; 200% text zoom and 400% page zoom. Check document overflow separately from intentional matrix/graph scrolling. Test current stable Chrome, Firefox, and Safari using available automation/manual coverage, and record actual browser versions rather than asserting compatibility without evidence.

### 18.3 Evidence required before approval

Deliver implementation screenshots or visual regression artifacts for the representative cases, token comparison results, automated accessibility findings and manual keyboard/screen-reader notes, list of documented source deviations, and confirmation that the README's original workflows still pass. A screenshot alone does not prove keyboard behavior, scientific correctness, or accessible contrast.

The design is ready when students can model, validate, simulate, analyze, and learn in a coherent workspace whose inherited BPMN Studio visual values are exact and whose Markov-specific interactions are clear, scientifically honest, and accessible.
