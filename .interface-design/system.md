# Design System: Deep Sync

## Intent

**Who**: Serious music collectors who treat their archive like a database. Late-night hunters who want professional software, not a streaming app.

**What they do**: Triage tracks efficiently. Scan status at a glance. Initiate downloads with minimal friction. Monitor progress without distraction.

**How it feels**: Matte. Quiet. Expensive. Like a Bloomberg Terminal for music acquisition — confident without shouting. Professional glassmorphism meets data terminal.

---

## Visual Direction

### Aesthetic
- **Professional Glassmorphism + Data Terminal**
- Dark matte surfaces with frosted glass overlays
- Soft diffused lighting, NO neon, NO glow
- Minimalist, expensive feel
- Dense data display

### Layout
- **Two-column interface**
  - Left Sidebar (200px): Frosted glass, vertical filter categories with counts, settings at bottom
  - Main Area: Dense data grid/spreadsheet with 32px row height

---

## Color Tokens

### Surfaces
| Token | Value | Usage |
|-------|-------|-------|
| `surface-base` | `#0d0d0f` | Deepest background |
| `surface-raised` | `#1a1a1e` | Elevated content areas |
| `surface-overlay` | `#242428` | Modals, dropdowns |
| `glass-bg` | `rgba(26, 26, 30, 0.7)` | Frosted panels |
| `glass-border` | `rgba(255, 255, 255, 0.08)` | Glass edge definition |

### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `border-subtle` | `rgba(255, 255, 255, 0.06)` | Row separators |
| `border` | `rgba(255, 255, 255, 0.1)` | Default borders |
| `border-focus` | `rgba(255, 255, 255, 0.2)` | Focus states |

### Text
| Token | Value | Usage |
|-------|-------|-------|
| `txt-primary` | `#ffffff` | Headings, primary content |
| `txt-secondary` | `#a0a0a6` | Body text, labels |
| `txt-muted` | `#6b6b70` | Metadata, timestamps |
| `txt-disabled` | `#44444a` | Disabled states |

### Status (Desaturated Pastels)
| Token | Value | Usage |
|-------|-------|-------|
| `status-pending` | `#7a7a80` | Awaiting action |
| `status-searching` | `#6b8cae` | Active search, Soulseek accent |
| `status-matched` | `#7a9e7a` | Found on Soulseek |
| `status-missing` | `#b89070` | Not available |
| `status-downloading` | `#6b8cae` | In progress |
| `status-complete` | `#8fb88f` | Successfully downloaded |
| `status-failed` | `#b87070` | Error state |

### Source Badges
| Token | Value | Usage |
|-------|-------|-------|
| `badge-soulseek` | `#6b8cae` | Soulseek source |
| `badge-beatport` | `#8fb88f` | Beatport link |
| `badge-bandcamp` | `#7ab8c0` | Bandcamp link |
| `badge-ytdlp` | `#b89070` | yt-dlp fallback |

---

## Typography

### Font Family
- **Primary**: Inter (400, 500, 600)
- **Mono**: JetBrains Mono, Fira Code

### Scale
| Size | Value | Usage |
|------|-------|-------|
| `xs` | 11px | Micro labels, timestamps |
| `sm` | 12px | Metadata, badges |
| `base` | 13px | Body text, grid rows |
| `lg` | 14px | Section headers |
| `xl` | 16px | Page titles |

---

## Spacing

4px base unit with scale:
- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-5`: 20px
- `space-6`: 24px
- `space-8`: 32px

---

## Layout Constants

| Token | Value | Usage |
|-------|-------|-------|
| `sidebar` | 200px | Left navigation width |
| `row` | 32px | Compact data row height |
| `thumb` | 40px | Album thumbnail size |
| `header` | 48px | Top header height |

---

## Component Patterns

### Glass Surface
```html
<div class="bg-glass-bg backdrop-blur-glass border border-glass-border">
```

### Status Badge
```html
<span class="badge bg-status-{variant} text-surface-base">Label</span>
```

### Button - Ghost
```html
<button class="btn-ghost">Action</button>
```

### Button - Primary
```html
<button class="btn-primary">Primary</button>
```

### Button - Icon
```html
<button class="btn-icon"><mat-icon>icon_name</mat-icon></button>
```

### Data Grid Row
```html
<div class="h-row grid grid-cols-[40px_1fr_100px_100px_80px_auto] items-center gap-3 px-4
            border-b border-border-subtle hover:bg-white/[0.02] transition-colors">
```

---

## Depth Strategy

- **No drop shadows** — depth comes from transparency and blur
- **Frosted glass** via `backdrop-filter: blur(20px)`
- **Subtle borders** (`rgba(255,255,255,0.08)`) define edges
- **Layered opacity** for hover states (`bg-white/[0.02]`, `bg-white/[0.04]`)

---

## Interaction States

### Hover
- Buttons: `bg-white/5` or `bg-white/20` for primary
- Rows: `bg-white/[0.02]`
- Text: `txt-secondary` → `txt-primary`

### Focus
- Border brightens to `border-focus`
- Background subtle lift

### Active/Selected
- Sidebar nav: `bg-white/[0.08]`
- Text: `txt-primary`

---

## Files

- **Tailwind config**: `packages/client/tailwind.config.js`
- **Global styles**: `packages/client/src/styles.scss`
- **Sidebar**: `packages/client/src/app/shared/components/sidebar/`
- **Status badge**: `packages/client/src/app/shared/components/status-badge.component.ts`
