# Design System: QualCount (Archival Book & Ledger)

## Visual World: Archival Book & Ledger
A physical, durable, and tactile aesthetic grounded in classic institutional folios, archival paper, and letterpress typography. Replaces dark-glass and neon-glow tropes with high-contrast, WCAG AA/AAA-compliant archival ink tones on warm paper surfaces.

## Surfaces & Foundation (Light-First Default)
- `--bg-canvas`: `#FAF8F4` (Warm archival rag paper; eliminates eye fatigue)
- `--bg-surface`: `#F2EFE9` (Book margin, sidebar index, header ribbon)
- `--bg-card`: `#FFFFFF` (Crisp organization folio card)
- `--border-hairline`: `#DDD6C8` (1px structural rule)
- `--border-strong`: `#BEB5A4` (Active focus / selected card border)
- `--ink-primary`: `#1C1B18` (Deep archival charcoal; >14:1 contrast ratio)
- `--ink-secondary`: `#5A554C` (Warm graphite; >6.5:1 contrast ratio)
- `--ink-muted`: `#8A8377` (Metadata, timestamps, subtle captions)

### Dark Matte Surface (Optional Toggle)
- `--bg-canvas-dark`: `#121417` (Deep charcoal matte paper)
- `--bg-surface-dark`: `#181B20` (Dark book folio margin)
- `--bg-card-dark`: `#1E2228` (Dark card surface)
- `--border-hairline-dark`: `#2D333B`
- `--ink-primary-dark`: `#F4F2ED`

## High-Contrast Multiplex Branch Palette

### 1. Financial / CSR Funding (Green Branch)
- Light Pending: `#2E7D52` | dashed (6 5) | stroke 2.0px
- Light Confirmed (`tick`): `#0F6B38` | solid | stroke 3.0px | Pill: `#E6F4EC` bg / `#0F6B38` ink
- Light Declined (`cross`): `#8FA397` | solid | stroke 1.5px | opacity 0.65
- Dark Confirmed (`tick`): `#34D399` | solid | stroke 3.0px | Pill: `#064E3B` bg / `#A7F3D0` ink

### 2. Direct Working Relationship ("White" Line -> Archival Ink)
- Light Pending: `#475569` | dashed (6 5) | stroke 2.0px
- Light Confirmed (`tick`): `#18181B` | solid | stroke 3.0px | Pill: `#18181B` bg / `#FAF8F4` ink
- Light Declined (`cross`): `#B4AEA3` | solid | stroke 1.5px | opacity 0.55
- Dark Confirmed (`tick`): `#F8FAFC` | solid | stroke 3.0px | Pill: `#F8FAFC` bg / `#111317` ink

### 3. Network Bridge & Amplification (Amber Branch)
- Light Pending: `#C2850C` | dashed (6 5) | stroke 2.0px
- Light Confirmed (`tick`): `#B45309` | solid | stroke 3.0px | Pill: `#FEF3C7` bg / `#92400E` ink
- Light Declined (`cross`): `#C2B9A7` | solid | stroke 1.5px | opacity 0.55
- Dark Confirmed (`tick`): `#FACC15` | solid | stroke 3.0px | Pill: `#451A03` bg / `#FDE68A` ink

### 4. Workspace Source Badges
- Local Badge: `#EFECE6` bg | `#3D3830` ink | 1px `#CFC7B8` border ("Local")
- Google Drive Badge: `#E8F0FE` bg | `#174EA6` ink | 1px `#AECBFA` border ("Google Drive")

### 5. Risk Severity Tokens
- Low: `#0F6B38` ink on `#E6F4EC`
- Moderate: `#9A5B00` ink on `#FEF3C7`
- Elevated: `#B54708` ink on `#FFEDD5`
- Critical: `#991B1B` ink on `#FEE2E2`

## Typography Scale (Offline Local Bundled)
- **Serif Display** (Headings, Workbook titles, Book cover): `Source Serif 4`, serif (600 weight, tight tracking)
- **Humanist Sans** (Navigation, body text, buttons, node labels): `IBM Plex Sans`, sans-serif (400, 500, 600)
- **Tabular Monospace** (All Funding M%, PUI indices, Risk scores, IDs): `IBM Plex Mono`, monospace (`font-variant-numeric: tabular-nums`)

## Radius & Spacing Discipline
- Card Radius: `6px` (sharp editorial folio)
- Button Radius: `4px`
- Badge Radius: `3px`
- Spacing Scale: Base 4px units (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`)

## Slop Detection Rules
- Zero purple/blue gradients or neon drop shadows.
- Zero card-in-card nesting ("Cardocalypse"). Use 1px hairlines and generous whitespace.
- Zero decorative icon tiles above section headers.
- Zero redundant helper paragraphs repeating field labels.
