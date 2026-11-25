---
name: Intelligent Tutoring System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#444651'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#006c4a'
  on-secondary: '#ffffff'
  secondary-container: '#82f5c1'
  on-secondary-container: '#00714e'
  tertiary: '#4b1c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e2c00'
  on-tertiary-container: '#f39461'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#773205'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  code-snippet:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an academic yet highly contemporary digital learning environment. The aesthetic balances institutional rigor with user-centered accessibility, deliberately rejecting flashy techno-futurism in favor of clarity, composure, and pedagogical trust.

### Brand Personality & Emotional Impact
- **Trustworthy & Authoritative:** Evoking the calm precision of an esteemed academic mentor rather than an unvetted chatbot experiment.
- **Cognitively Light:** Eliminating visual noise, high-saturation gradients, and unnecessary animations so students and educators can focus on deep comprehension and content retention.
- **Measurable & Accomplished:** Reinforcing momentum through intentional, quiet indicators of mastery and progress without game-like sensory overload.

### Design Movement
**Refined Contemporary SaaS / Academic Functionalism.** The system relies on pure white foundations, structured slate surfaces, hairline administrative borders (1px), crisp data grids, and measured typographical hierarchy. Visual interest stems from impeccable layout rhythm, balance, and purposeful emerald milestones rather than decorative flourishes.

## Colors

The palette is engineered for prolonged focus and legibility during intensive cognitive tasks. It is rooted in clinical neutrals, authoritative deep navies, and restrained emerald progression markers.

### Palette Architecture
- **Primary Canvas & Backgrounds:** `#ffffff` serves as the primary canvas for active workspaces, exam sessions, and reading panes. `#f8fafc` and `#f1f5f9` form the structural canvas backing, toolbars, and subtle sidebar panels.
- **Deep Navy & Ink (`#0f172a`, `#1e293b`, `#1e3a8a`):** Used strictly for high-priority typographical hierarchy, headers, primary action triggers, and brand anchors. Never tint navies with purple or violet.
- **Secondary Slate (`#475569`, `#64748b`):** Delivers readable, accessible secondary prose, metadata captions, system iconography, and inactive states. Hairline borders standardize on `#e2e8f0`.
- **Mastery Emerald (`#059669`, `#10b981`):** Reserved exclusively for positive feedback, validated answers, mastery badges, step completion, and quantitative trajectory lines. Used deliberately so positive signals retain psychological value.
- **Strict Guardrail:** No neon glows, no violet-to-cyan gradients, and no iridescent AI sparkles. All state indicators must be solid, grounded, and legible against light backgrounds.

## Typography

Typography relies on **Inter** to maintain neutral, razor-sharp legibility at all scale steps, paired with **JetBrains Mono** for numerical proofs, formulaic syntax, and technical code exercises.

### Typographic Rules
- **Negative Tracking on Headlines:** Tighten display levels slightly (`-0.01em` to `-0.02em`) to bind headline phrasing compactly, maintaining an editorial, composed impression.
- **Expanded Small Labels:** Metadata tags, curriculum tags, and chapter headers in `label-sm` require positive tracking (`0.04em`) and uppercase formatting when rendered alongside dense dashboard data.
- **Reading Comfort:** Body text must never exceed 72 characters per line in learning reading modules. Maintain a line height of `1.6x` (`body-lg`) to reduce visual fatigue during diagnostic reading comprehension exercises.

## Layout & Spacing

The layout is structured around an intentional 8-point baseline grid, prioritizing structured sidebars, analytical split-screens, and uncluttered focus modes.

### Layout System
- **Desktop (1200px+):** 12-column responsive grid with a persistent 280px left navigation rail for curriculum navigation, `1.5rem` gutters, and `2rem` outer page margins. Active workspace views can transition to a split 50/50 canvas: prompt/reading material on the left, interactive responses on the right.
- **Tablet (768px - 1199px):** 8-column layout. The left navigation rail collapses into an icon shelf or slide-over drawer. Gutter remains `1.5rem`.
- **Mobile (Under 768px):** 4-column layout with `1rem` margins and gutters. Multi-step question components stack into a linear top-to-bottom sequence.

### Spacing Usage
- `space-xs` (4px) & `space-sm` (8px): Micro-spacing within component shells, such as icon-to-label gaps, badge paddings, and list item separators.
- `space-md` (16px): Standard internal padding for cards, form field stacks, and question options.
- `space-lg` (24px) & `space-xl` (40px): Section divisions, major rubric category breaks, and dashboard card arrangements.

## Elevation & Depth

Visual hierarchy in this design system avoids heavy shadows, floating neon halos, or high-contrast drop shadows. It relies instead on crisp surface boundaries and ambient, feather-light shadows.

### Elevation Hierarchy
- **Level 0 (Flat / Canvas):** Neutral backgrounds (`#f8fafc` or `#ffffff`). Flat surfaces rely solely on `#e2e8f0` 1px borders to establish spatial zones.
- **Level 1 (Cards & Modules):** Work surface cards and question panels sit on `#ffffff` with a subtle 1px border (`#e2e8f0`) and an ambient, low-opacity shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)`.
- **Level 2 (Hover States & Flyouts):** Active assessment cards and dropdown menus leverage a slightly broadened ambient shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`, paired with a darkened border tone (`#cbd5e1`).
- **Level 3 (Modals & Overlays):** Used for focus reviews, reference indices, and modal diagnostic dialogs: `0 12px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.04)` over a backdrop tint of `#0f172a` at 40% opacity.

## Shapes

The design system adopts a **Soft (Level 1)** corner geometry. Roundedness is restrained and functional, conveying professional precision rather than playful informality.

### Corner Radius Standards
- **Standard UI Elements (`0.25rem` / 4px):** Form inputs, standard buttons, answer choice selector frames, and progress bar tracks.
- **Containers & Surfaces (`0.5rem` / 8px):** Diagnostic question cards, code display blocks, analytics widgets, and modular panes (`rounded-lg`).
- **Overlays & Dialogs (`0.75rem` / 12px):** Central assessment modals and full-screen dialog containers (`rounded-xl`).
- **Full Radius (`9999px`):** Status pills, mastery percentage chips, and avatar containers only. Never use full pill geometry for functional action buttons.

## Components

### Buttons
- **Primary:** Background `#1e3a8a`, text `#ffffff`, border none, 4px border radius. Hover state transitions to `#1e293b`. Focus rings use a 2px offset with `#1e3a8a` at 50% alpha.
- **Secondary:** Background `#ffffff`, text `#1e293b`, 1px solid `#e2e8f0`. Hover state transitions to `#f8fafc` with border `#cbd5e1`.
- **Mastery Action / Next Step:** Background `#059669`, text `#ffffff`. Reserved for completion actions, lesson submissions, and rubric advancements.

### Chips & Badges
- **Skill Status:** Light background (`#ecfdf5`), border 1px solid `#a7f3d0`, text `#065f46`, font `label-sm`.
- **Category / Metadata:** Background `#f1f5f9`, border 1px solid `#e2e8f0`, text `#475569`.
- **Needs Review:** Background `#fffbeb`, border 1px solid `#fde68a`, text `#92400e`.

### Interactive Assessment Cards & Radio Selectors
- **Option Container:** Background `#ffffff`, border 1px solid `#e2e8f0`, padding `1rem`, border radius 4px.
- **Hover State:** Border color shifts to `#94a3b8`, background shifts to `#f8fafc`.
- **Selected State:** Border 1.5px solid `#1e3a8a`, background `#f8fafc`, radio node highlighted with `#1e3a8a`.
- **Validated Correct State:** Border 1.5px solid `#059669`, background `#f0fdf4`, indicator filled with `#059669`.

### Text Inputs & Answer Prompts
- Background `#ffffff`, 1px solid `#e2e8f0`, text `#0f172a`, placeholder `#94a3b8`.
- Focus: Border color `#1e3a8a`, with a subtle outer ring `0 0 0 3px rgba(30, 58, 138, 0.1)`. No harsh drops or non-neutral shadows.

### Progress Indicators & Analytics
- **Mastery Progress Bars:** Background rail `#e2e8f0` (height 6px or 8px, border radius 4px). Active fill uses solid `#10b981` (or `#059669` for higher contrast standards). No flashing shimmer animations.
- **Data Charting:** Clean vector line charts using `#1e3a8a` for historical performance and `#059669` for benchmark masteries against light grey baseline grids (`#f1f5f9`).

### Step-by-Step Hint Disclosures
- Structured as collapsed accordions with a hairline border (`#e2e8f0`) and subtle `#f8fafc` header. When expanded, reveals progressive pedagogical scaffolding without giving away final solutions immediately.