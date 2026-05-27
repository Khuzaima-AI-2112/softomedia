# Hamburger Menu Experiments

Three standalone HTML experiment pages for exploring hamburger menu variants. All built from the exact `HamburgerMenu.jsx` source — same `PERSONA_SWATCHES`, same `navItems`, same Escape/backdrop-click close behaviour. Tailwind classes match the component as closely as possible.

| File | Variant | Key difference |
|---|---|---|
| `hamburger-variant-a-current.html` | **A — Current Production** | Faithful replica of main: left slide-in `w-72`, `bg-black/40 backdrop-blur-sm`, `grid-cols-2` swatch grid |
| `hamburger-variant-b-top-sheet.html` | **B — Compact Top Sheet** | Drops down from below the sticky header; desktop `grid-cols-3` layout; trigger morphs `menu` ↔ `close` |
| `hamburger-variant-c-right-drawer.html` | **C — Right-Side Wide Drawer** | Trigger at right end of header; `w-80` slide-in-from-right; `size-3` dots + `check` icon on active role; `ring-2` avatar + inline role badge + bordered logout |

## How to use

Open any file directly in a browser — no build step needed. Each page has:
- A dark mode toggle (top-right moon icon)
- A coloured label badge identifying the variant
- Fully interactive drawer/sheet
