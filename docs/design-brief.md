# Design Brief — order-plat (XPRSO)

> Derived from visual analysis of `/inspo` (`inspos/`) and `inspos/notes.md`.
> Visual reference files:
> - `01-glass-folder.jpg` (`5aaaac17729873418a443d2c6ee863b9.jpg`): Frosted dark glass overlay with soft specular depth.
> - `02-upload-card.jpg` (`6a03fa0dc3a785ce71801fe0d2d1a0b5.jpg`): Ultra-rounded white card (r=32px), pill buttons, vivid electric blue primary action.
> - `03-pill-nav.jpg` (`240b93abd26189dca224c4b16d0af188.jpg`): Pill-shaped floating nav bar with solid obsidian active pill, compact pill status chips.
> - `04-mono-controls.jpg` (`10889a6a0ba4c2a8e1176a42e61ae88f.jpg`): Monochrome controls, glossy near-black active squircles/pills with soft drop shadows, pale grey inactive states.
> - `05-neumorphic-widget.jpg` (`a43735ec9f45291f7e912b3b4ef81454.jpg`): Soft grey background, inset/debossed wells, tactile raised round buttons, wide extended display numbers.

---

## 1. Overall Mood & Aesthetic

**Mood (4 words):** *Calm, tactile, sculptured, precision.*

### What makes it feel "hyper-modern":
1. **Sculptural Monochrome Base:** Pure, soft neutral canvas (#F4F4F6 light / #0F0F12 dark) without visual noise. Surfaces appear physically shaped through subtle multi-layered diffused shadows and delicate 1px border lighting rather than harsh dividing lines.
2. **Obsidian Active State vs. Pale Resting State:** Active categories, selections, and checkboxes switch from subtle grey to deep obsidian (#121214) with a micro-specular rim highlight, giving satisfying tactile feedback.
3. **Singular Vivid Electric Accent:** Vibrant cobalt/electric blue (#0066FF / #2563EB) is reserved strictly for primary transactional actions (Pay / Settle, progress indicators, confirmed badges), creating zero visual ambiguity about what matters.
4. **Frosted Smoked Glass Overlays:** Modals, sticky bottom sheets, and the live grand-total panel float above content with dark frosted glass (`backdrop-blur-xl`, `rgba(18, 18, 22, 0.78)`), echoing `01-glass-folder.jpg`.
5. **Physicality with High Contrast:** Inset debossed wells for input fields, PIN pad display, and search bars, paired with crisp WCAG 2.2 AA compliant typography and tabular numbers.

---

## 2. Colour Palette (Light & Dark)

### Light Theme
- **Canvas / Background:** `#F2F3F5` (calm, warm-neutral light grey)
- **Base Surface (Cards / Panels):** `#FFFFFF` (crisp white with `shadow-soft-xl`)
- **Inset / Well Surface:** `#EAEBED` (debossed input wells and segmented track)
- **Elevated Floating Surface:** `#FFFFFF` with double diffused drop shadow
- **Glass Overlay Surface:** `rgba(20, 20, 26, 0.82)` with `backdrop-filter: blur(24px)` (inverted high-contrast overlay)
- **Primary / Brand Action:** `#0066FF` (electric cobalt blue)
  - Hover: `#0052CC`
  - Active: `#0040A8`
  - Glow / Shadow: `0 8px 24px -4px rgba(0, 102, 255, 0.35)`
- **Obsidian / Active Item:** `#121214` (solid obsidian pill with white text)
- **Accent Soft:** `#EBF3FF` (tinted blue pill background for badges)
- **Text Tiers:**
  - Primary: `#111827` (deep slate black, high contrast)
  - Secondary: `#4B5563` (muted medium grey, AA compliant)
  - Tertiary / Muted: `#6B7280` (supporting metadata)
  - Inverse: `#FFFFFF` (on obsidian and primary blue)
- **Semantic / Status:**
  - Success: `#10B981` (soft emerald) / `#ECFDF5`
  - Warning: `#F59E0B` (amber) / `#FFFBEB`
  - Danger / Void: `#EF4444` (crimson) / `#FEF2F2`
  - Info: `#3B82F6` (blue) / `#EFF6FF`
- **Borders & Rim Lighting:**
  - Standard border: `rgba(0, 0, 0, 0.06)`
  - Active rim / highlight: `inset 0 1px 1px 0 rgba(255, 255, 255, 0.25)`

### Dark Theme (Derived from 01 Dark Glass & Near-Black States)
- **Canvas / Background:** `#0A0A0C` (deep obsidian canvas)
- **Base Surface (Cards / Panels):** `#16161A` (rich charcoal surface with subtle rim light)
- **Inset / Well Surface:** `#101014` (recessed inputs and tracks)
- **Elevated Floating Surface:** `#1E1E24` (soft diffused highlight)
- **Glass Overlay Surface:** `rgba(18, 18, 24, 0.85)` with `backdrop-filter: blur(24px)`
- **Primary / Brand Action:** `#2563EB` (vibrant blue adapted for dark backgrounds)
  - Glow / Shadow: `0 8px 24px -4px rgba(37, 99, 235, 0.45)`
- **Obsidian / Active Item:** `#FFFFFF` (on dark, active toggles become crisp white with black text, or intense glowing obsidian with white rim)
- **Text Tiers:**
  - Primary: `#F9FAFB` (crisp white)
  - Secondary: `#9CA3AF` (soft cool grey)
  - Tertiary / Muted: `#6B7280`
  - Inverse: `#0A0A0C`
- **Borders & Rim Lighting:**
  - Standard border: `rgba(255, 255, 255, 0.08)`
  - Top specular highlight: `inset 0 1px 0 0 rgba(255, 255, 255, 0.12)`

---

## 3. Typography & Numerical Display

- **Primary UI Font:** `Plus Jakarta Sans` / `Inter`, system fallback `system-ui, -apple-system, sans-serif`
  - Clean geometric humanist sans-serif with excellent legibility at micro and display sizes.
- **Display & Numerical Font:** `Space Grotesk` / `Outfit` / `Plus Jakarta Sans` (extended display feel inspired by `05-neumorphic-widget.jpg`).
- **Tabular Figures:** `font-variant-numeric: tabular-nums;` used **strictly** on all prices, quantities, currency symbols, and invoice numbers to eliminate layout shift or jitter when totals update.
- **Hierarchy:**
  - **Hero / Grand Total:** 32–40px, bold (font-weight 800), wide tracking (`tracking-tight`), tabular numbers.
  - **Header / Section Title:** 20–24px, semibold (600), `tracking-tight`.
  - **Product Title:** 15–16px, semibold (600), high contrast.
  - **Body / Labels:** 13–14px, medium (500).
  - **Micro Badges / Chips:** 11–12px, semibold (600), uppercase tracking +0.05em.

---

## 4. Shapes, Elevation & Surface Treatments

- **Border Radii:**
  - Buttons & Chips: `rounded-full` (9999px pill)
  - Cards (Menu items, order cards): `rounded-2xl` to `rounded-3xl` (20px to 28px)
  - Modals, Bottom Sheet, Inset Wells: `rounded-3xl` (28px to 32px)
  - Controls / Checkboxes / Stepper buttons: `rounded-xl` to `rounded-2xl` (12px to 16px)
- **Shadows (Soft Multi-Layered Diffusion):**
  - Raised Card: `0 10px 30px -10px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.03)`
  - Active Obsidian Pill: `0 8px 18px -4px rgba(18, 18, 20, 0.35)`
  - Neumorphic Well (Inset): `inset 0 2px 4px 0 rgba(0, 0, 0, 0.06), inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)`
  - Primary Action Glow: `0 10px 25px -5px rgba(0, 102, 255, 0.4)`
- **Tactile Inputs:** Inset recessed well styling for text inputs, PIN circles, and search bars.
- **Glass Overlays:** 24px Gaussian blur (`backdrop-blur-xl`) with 1px top specular border.

---

## 5. Layout & Responsiveness

- **Touch-First Ergonomics:**
  - Minimum touch target: `48px × 48px` on all buttons, steppers, and menu tiles.
  - Bottom-anchored primary actions on phones within natural thumb radius.
  - Quick stepper `+` and `−` controls with large tap pads.
- **Tablet (Primary Workstation - 768px to 1280px):**
  - Split two-column layout:
    - Left (60–65%): Category pill chips, search well, responsive product grid (2 to 4 cards per row).
    - Right (35–40%): Sticky order panel showing live line items, tax breakdowns, and grand total card.
- **Phone (360px to 480px):**
  - Single-column menu grid with category horizontal pill scroll.
  - Bottom sticky bar showing item count and grand total pill.
  - Tapping opens the dark frosted glass bottom sheet with line details and settlement button.
- **Desktop (1280px+):**
  - Three-tier layout: side navigation pill bar, spacious menu/admin workspace, and detail drawer.

---

## 6. Motion & Micro-interactions

- **Library:** `motion` (Framer Motion).
- **Durations & Easing:**
  - Micro-interactions (pill tab switches, button press): 150ms–200ms `[0.2, 0, 0, 1]`
  - Order item added: Spring animation `stiffness: 400, damping: 25` (subtle pulse / scale up to 1.05 and back).
  - Sheet slide & dialog open: 280ms cubic-bezier `[0.16, 1, 0.3, 1]`.
  - Number roll / Total update: Smooth numeric transitions.
- **Haptic Feedback:** `navigator.vibrate?.(10)` on adding items or tapping PIN pad where hardware allows.
- **Accessibility:** `prefers-reduced-motion` suppresses scale and slide animations, using simple opacity fades.

---

## 7. Do's and Don'ts

### DO:
- ✅ **DO** use pill shapes (`rounded-full`) for all buttons, tags, chips, and segmented navigation.
- ✅ **DO** use deep obsidian (`#121214`) for active selections and filters, with high contrast white text.
- ✅ **DO** reserve electric cobalt blue (`#0066FF`) strictly for the primary conversion actions (e.g. "Settle Order", "Save Changes", "Confirm").
- ✅ **DO** render all prices and numbers in tabular figures with the Indian rupee symbol (`₹`) formatted according to Indian digit grouping (`en-IN`).
- ✅ **DO** provide inset/debossed well styling for inputs, search bars, and the admin PIN pad.
- ✅ **DO** maintain strict WCAG 2.2 AA contrast ratios across all text elements.

### DON'T:
- ❌ **DON'T** use flat, harsh 1px black borders everywhere; rely on soft shadows and subtle tone shifts.
- ❌ **DON'T** use low-contrast grey text on grey backgrounds for prices or totals.
- ❌ **DON'T** use generic square cards with sharp 4px or 8px corners.
- ❌ **DON'T** splatter multiple bright colours across the interface; keep it monochrome with blue accent only.
- ❌ **DON'T** copy logos, sample texts, or brand marks from the `/inspo` files.
