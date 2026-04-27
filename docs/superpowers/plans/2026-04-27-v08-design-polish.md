# Design Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the visual language from prototype to product — refined typography, generous whitespace, consistent card styling, subtle microinteractions, and a mobile-first capture flow.

**Architecture:** All changes are additive CSS and component-level Tailwind class updates. No new routes or data models. Work in this order: CSS variables first (establishes the design token baseline), then cards/buttons, then animations, then mobile nav.

**Tech Stack:** Tailwind CSS 4, Next.js 16, Google Fonts (next/font), CSS custom properties.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/globals.css` | Modify | Add full design token set: fonts, colors, spacing, radius |
| `src/app/layout.tsx` | Modify | Add Source Serif 4 font, apply font variables to body |
| `src/components/ui/Button.tsx` | Create | Canonical Button component replacing ad-hoc button classes |
| `src/components/ui/Card.tsx` | Create | Canonical Card component with consistent padding + hover lift |
| `src/components/ui/Input.tsx` | Create | Canonical Input for all text inputs |
| `src/components/layout/MobileNav.tsx` | Create | Bottom nav bar for mobile (Log / Graph / Capture / Query / More) |
| `src/app/layout.tsx` | Modify | Add MobileNav below main content on mobile |

---

### Task 1: CSS design tokens

**Context:** `globals.css` currently has basic CSS variables and node colors. This task adds the full token set from the spec: font stacks (with Geist + Source Serif 4), semantic colors, border and radius tokens. Tailwind picks these up via the `@theme inline` block.

The existing node colors (`--color-node-hunch`, etc.) and `--nav-height` must not change — other components depend on them.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the `:root` and `@theme inline` blocks in globals.css**

Find the existing `:root` block and `@theme inline` block and replace them entirely with:

```css
:root {
  --nav-height: 49px;

  /* Semantic backgrounds */
  --color-bg: #FAFAF7;
  --color-bg-elevated: #FFFFFF;
  --color-bg-subtle: #F4F3EF;

  /* Semantic text */
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #555555;
  --color-text-tertiary: #999999;

  /* Borders */
  --color-border: #E8E6E1;
  --color-border-strong: #D4D2CD;

  /* Legacy vars kept for compatibility */
  --background: #FAFAF7;
  --foreground: #1A1A1A;
}

.dark {
  --color-bg: #0F0F0D;
  --color-bg-elevated: #1A1A18;
  --color-bg-subtle: #141412;
  --color-text-primary: #F0EFE9;
  --color-text-secondary: #A8A6A0;
  --color-text-tertiary: #666462;
  --color-border: #2A2A27;
  --color-border-strong: #3A3A37;
  --background: #0F0F0D;
  --foreground: #F0EFE9;
}

@theme inline {
  /* Fonts */
  --font-display: 'Geist', 'Inter', system-ui, sans-serif;
  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
  --font-serif: 'Source Serif 4', Georgia, serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  /* Semantic colors — picked up by Tailwind as bg-cof-bg, text-cof-text-primary, etc. */
  --color-cof-bg: var(--color-bg);
  --color-cof-bg-elevated: var(--color-bg-elevated);
  --color-cof-bg-subtle: var(--color-bg-subtle);
  --color-cof-text-primary: var(--color-text-primary);
  --color-cof-text-secondary: var(--color-text-secondary);
  --color-cof-text-tertiary: var(--color-text-tertiary);
  --color-cof-border: var(--color-border);
  --color-cof-border-strong: var(--color-border-strong);

  /* Background / foreground for body */
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  /* Node-type accent colors — unchanged */
  --color-node-hunch: #7F77DD;
  --color-node-assumption-bg: #1D9E75;
  --color-node-assumption-fg: #D85A30;
  --color-node-test: #D4537E;
  --color-node-learning: #378ADD;
  --color-node-option: #BA7517;
  --color-node-entity: #888780;
  --color-node-site: #639922;
  --color-node-commitment: #185FA5;

  /* Earth palette */
  --color-cof-earth: #8B7355;
  --color-cof-ocean: #2D6A7F;
  --color-cof-atmosphere: #6B8AA3;
  --color-cof-canopy: #5A7247;
}
```

- [ ] **Step 2: Update the body rule to use new tokens**

Replace:
```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

With:
```css
body {
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Add card utility class and microinteraction keyframe to globals.css**

Add at the bottom of `globals.css`:

```css
/* Card hover lift */
@keyframes card-lift {
  from { transform: translateY(0); box-shadow: none; }
  to   { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
}

/* Tension alert pulse — 3 cycles then stops */
@keyframes tension-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Shared card hover — apply with .card-hover */
.card-hover {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.card-hover:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}
.dark .card-hover:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add full design token set — fonts, semantic colors, card hover utilities"
```

---

### Task 2: Add Source Serif 4 font

**Context:** The layout currently loads Inter and JetBrains Mono via `next/font/google`. Add Source Serif 4 for long-form text (node descriptions, capture content). The font variable `--font-serif` is already declared in globals.css; this task loads the actual font file.

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add Source Serif 4 to layout.tsx**

Find the font import block at the top of `src/app/layout.tsx`:

```typescript
// Current:
import { Inter, JetBrains_Mono } from 'next/font/google';

// Replace with:
import { Inter, JetBrains_Mono, Source_Serif_4 } from 'next/font/google';
```

Add the font configuration after the existing font declarations:

```typescript
const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});
```

Update the body className to include the new variable:

```typescript
// Find:
<body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>

// Replace with:
<body className={`${inter.variable} ${jetbrainsMono.variable} ${sourceSerif4.variable} font-sans antialiased`}
  style={{ background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
```

Update `@theme inline` in globals.css to reference the actual Next.js font variable:

```css
--font-serif: var(--font-source-serif), Georgia, serif;
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "layout.tsx"
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: add Source Serif 4 font via next/font for long-form text"
```

---

### Task 3: Canonical UI components — Button, Card, Input

**Context:** The codebase has ad-hoc button and input classes scattered across components. This task creates canonical components that centralise the design. Existing components don't need to be immediately migrated — the canonical components are available for new work and gradual adoption.

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`

- [ ] **Step 1: Write Button**

```typescript
// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly size?: 'sm' | 'md';
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-node-hunch text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-node-hunch/50',
  secondary: 'bg-transparent border border-cof-border text-cof-text-primary hover:border-cof-border-strong hover:bg-cof-bg-subtle',
  ghost: 'bg-transparent text-cof-text-secondary hover:text-cof-text-primary hover:bg-cof-bg-subtle',
  danger: 'bg-transparent border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
};

export function Button({ variant = 'primary', size = 'md', className = '', disabled, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium transition-all duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${className}
      `.trim()}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Write Card**

```typescript
// src/components/ui/Card.tsx
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly hover?: boolean;
  readonly padding?: 'sm' | 'md' | 'lg';
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ hover = false, padding = 'md', className = '', children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`
        bg-white dark:bg-gray-900
        border border-cof-border dark:border-gray-800
        rounded-xl
        ${PADDING_CLASSES[padding]}
        ${hover ? 'card-hover cursor-pointer' : ''}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Write Input**

```typescript
// src/components/ui/Input.tsx
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label?: string;
  readonly error?: string;
  readonly helper?: string;
}

export function Input({ label, error, helper, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-cof-text-secondary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`
          w-full text-sm px-3 py-2
          bg-white dark:bg-gray-900
          border rounded-lg
          text-cof-text-primary placeholder:text-cof-text-tertiary
          transition-colors duration-150
          focus:outline-none
          ${error
            ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400/30'
            : 'border-cof-border hover:border-cof-border-strong focus:border-node-hunch focus:ring-1 focus:ring-node-hunch/20'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          text-[16px] sm:text-sm  /* prevent zoom on iOS */
          ${className}
        `.trim()}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {helper && !error && <p className="text-xs text-cof-text-tertiary">{helper}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "Button|Card|Input" | grep "src/components/ui"
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Card.tsx src/components/ui/Input.tsx
git commit -m "feat: add canonical Button, Card, Input UI components with design tokens"
```

---

### Task 4: Mobile bottom navigation

**Context:** The app is used on phones for quick meeting captures. The current top NavBar is hard to use on mobile. Add a bottom nav bar on mobile only (hidden on desktop) with the 5 most important destinations.

**Files:**
- Create: `src/components/layout/MobileNav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write MobileNav**

```typescript
// src/components/layout/MobileNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/log', label: 'Log', icon: '📋' },
  { href: '/graph', label: 'Graph', icon: '🕸' },
  { href: '/capture', label: 'Capture', icon: '＋' },
  { href: '/query', label: 'Query', icon: '💬' },
  { href: '/', label: 'Home', icon: '⌂' },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-t border-cof-border safe-area-inset-bottom">
      {NAV_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors
            ${isActive(item.href)
              ? 'text-node-hunch'
              : 'text-cof-text-tertiary hover:text-cof-text-secondary'
            }
            ${item.label === 'Capture' ? 'relative' : ''}`}
        >
          {item.label === 'Capture' ? (
            <span className="w-10 h-10 rounded-full bg-node-hunch text-white flex items-center justify-center text-lg font-light -mt-4 shadow-lg">
              {item.icon}
            </span>
          ) : (
            <span className="text-xl leading-none">{item.icon}</span>
          )}
          <span className="text-[10px] font-medium">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Add MobileNav to layout.tsx**

In `src/app/layout.tsx`, import `MobileNav` and add it after the `<main>` element inside the `<AuthProvider>`:

```typescript
// Add import:
import { MobileNav } from '@/components/layout/MobileNav';

// In the JSX, after </main>:
{user && <MobileNav />}
```

Also add bottom padding to main on mobile so content isn't hidden behind the nav:

```typescript
// Update the main className:
<main className="h-screen overflow-y-auto pt-[49px] pb-16 lg:pb-0">
```

- [ ] **Step 3: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "MobileNav"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/MobileNav.tsx src/app/layout.tsx
git commit -m "feat: add mobile bottom navigation bar (hidden on desktop)"
```

---

### Task 5: Capture submit microinteraction

**Context:** The QuickCaptureForm currently has a plain submit button. Add a three-phase transition: "Capturing…" with pulse during submission → "✓ Captured" for 1 second → close. This signals the system received the input and builds rhythm.

Read `src/components/capture/QuickCaptureForm.tsx` before editing to understand current submit state.

**Files:**
- Modify: `src/components/capture/QuickCaptureForm.tsx`

- [ ] **Step 1: Add submit state tracking**

In `QuickCaptureForm.tsx`, find the existing submit state (likely `isLoading` or `isSubmitting` boolean). Replace with a tri-state:

```typescript
type SubmitPhase = 'idle' | 'capturing' | 'captured';
const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle');
```

- [ ] **Step 2: Update the submit handler**

Find the existing submit handler and wrap the success case:

```typescript
// After a successful submission:
setSubmitPhase('capturing');
// ... existing fetch/API call ...
// On success:
setSubmitPhase('captured');
setTimeout(() => {
  setSubmitPhase('idle');
  // existing close/reset logic
}, 1000);
```

- [ ] **Step 3: Update the submit button**

Find the submit button and replace the static label:

```typescript
<button
  type="submit"
  disabled={submitPhase !== 'idle'}
  className={`
    px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200
    ${submitPhase === 'captured'
      ? 'bg-node-assumption-bg text-white'
      : 'bg-node-hunch text-white hover:opacity-90'
    }
    disabled:opacity-70
  `}
>
  {submitPhase === 'idle' && 'Capture'}
  {submitPhase === 'capturing' && (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
      Capturing…
    </span>
  )}
  {submitPhase === 'captured' && '✓ Captured'}
</button>
```

- [ ] **Step 4: Run QuickCaptureForm tests**

```bash
npx vitest run src/components/capture/__tests__/QuickCaptureForm.test.tsx
```

Expected: PASS (existing tests should still pass; the state machine change is backward-compatible)

- [ ] **Step 5: Commit**

```bash
git add src/components/capture/QuickCaptureForm.tsx
git commit -m "feat: add three-phase capture submit microinteraction (capturing → captured → close)"
```
