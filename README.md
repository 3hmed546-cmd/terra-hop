# TERRA HOP — Frontend Preview

Homepage-only preview of the TERRA HOP store. No backend, no admin dashboard, no login page, no API.
The build plan is `Terra_Hop_Frontend_Homepage_Plan.md`. Progress is recorded in its Section 12.

## Run it (three commands)

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (static) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Generate route types, then run TypeScript in strict mode |
| `npm run lint` | ESLint |

| `npm run test:f7` | Phase F7 checks (Playwright + axe). First run: `npx playwright install chromium`. Writes screenshots to `review/screenshots/` |

Lighthouse (mobile) is run by hand: `npm run build && npm run start`, then `npx lighthouse http://localhost:3000 --preset=perf --form-factor=mobile --view`.

## Structure

```
src/
  app/            layout, homepage, not-in-preview, not-found, fonts, global styles and design tokens
  components/     ui (Button, inputs, Logo), layout (Header, MobileMenu, Footer), sections, drop
  content/        home.ts (all copy and links) and images.ts (all image paths and alt text)
  fonts/          self-hosted WOFF2 files (Archivo, Inter) and their licenses
  lib/            ui-strings.ts (every interface label lives here)
public/
  logo/           TERRA HOP logo (PNG for now, replace with SVG)
  preview-images/ hero photo and placeholder tiles, see MANIFEST.md
tests/            Phase F7 checks
review/           screenshots for the owner
```

## Design tokens

Colors, radius, and fonts are defined once in `src/app/globals.css`. The default Tailwind palette,
shadows, and blur are reset, so only the five brand colors exist. Do not add other colors.

## Status

Phases F0 to F8 are written. The F7 quality checks are in `tests/` and have **not been run yet**. See Section 12 of the plan and `REVIEW.md`.

## Preview-only notes (from the plan)

- The signup form validates in the browser, shows the success message, and stores and sends nothing.
- All prices, contact details, and photos in the preview are placeholders.
