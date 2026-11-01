# TERRA HOP preview: review notes

Run it: `npm install`, `npm run dev`, open http://localhost:3000.

## What was built

Homepage `/` with 8 sections in order: Header, Hero, The Drop, Brand Story, Details, Lookbook, Signup, Footer. Mobile menu, stand-in page (`/not-in-preview`), and 404. Design tokens, fonts, and components from the plan.

## What is placeholder

- Photos: only the hero is the owner's photo. Product, story, and lookbook slots are gray tiles (see `public/preview-images/MANIFEST.md`).
- Prices, phone number, email, Instagram, WhatsApp, and every link (all marked `demo: true` in `src/content/home.ts`).
- Logo is a PNG made from the supplied image. A vector SVG and the orbit mark alone are still wanted.

## Changes from the plan (owner decisions)

- Hero is full-bleed with the logo over the photo (like the Peso Studios reference), instead of the split image and Obsidian panel. See `DECISIONS.md`, decision 13.
- No stock photos.

## Intentionally missing

Shop, product, and content pages, cart, checkout, backend, admin, Arabic and RTL, SEO beyond title and description.

## Quality results (Phase F7)

Not measured yet. Fill in after `npm run test:f7` and Lighthouse:

| Check | Result |
|---|---|
| Typecheck, lint, build | |
| Playwright tests | |
| axe violations | |
| Lighthouse mobile (performance, accessibility, best practices) | |
| LCP, CLS | |
| Hero image size on mobile | |

## Feedback checklist

Overall (approved or needs changes), sections to change, sections to remove or reorder, photos, copy, anything missing.
