# TERRA HOP — Frontend Preview Plan (Homepage Only, No Backend)

| | |
|---|---|
| **Audience** | The owner (to review) and Google Antigravity (to build) |
| **Date** | 2026-10-28 |
| **Status** | Build plan for a visual preview. Nothing here is the final store. **Progress: All phases F0 to F8 are written. **Nothing has been built, run, or measured yet** (F7 results are pending, see Section 12.13). (see Section 12).** |
| **Related files** | `Terra_Hub_MVP_Plan.md` (full build brief) and `Terra_Hub_Website_Plan_v3.md` (design system and rules) |
| **Precedence** | For this preview, **this file wins** over the MVP brief on scope only. Design, colors, typography, accessibility, and copy rules still follow v3. |
| **Brand** | TERRA HOP (men's oversized streetwear, Egypt) |

## How to start (paste this as your first instruction)

> Read `Terra_Hop_Frontend_Homepage_Plan.md` fully, then Sections 3, 4, 6, 9, 10, and 11 of `Terra_Hub_Website_Plan_v3.md`. Build only what this plan lists, phase by phase (Section 7). Do not ask me questions: every decision is already made in Section 9. If something is unclear, choose the simplest option that fits and write it in `DECISIONS.md`. After each phase run typecheck, lint, and build, start the app, check it in a browser at 375, 768, 1024, and 1440 px wide, fix what fails, then continue. Report what passed at the end of each phase.

---

## 1. Goal

Give the owner a **real, clickable homepage** to judge by eye before any real engineering starts.

- If the owner likes it: the same components, tokens, and content shapes carry into the full MVP build (Section 10).
- If the owner does not like it: we change it together, round by round (Section 8), at the cost of a few files instead of a whole system.

The preview must look like the finished store would look on its best day, using placeholder content and placeholder photos.

---

## 2. Scope

### 2.1 Build now

| Area | Included |
|---|---|
| Homepage `/` | All **8 sections** from v3 Section 6: Header, Hero, The Drop, Brand Story, Product Quality and Details, Editorial Lookbook, Community Signup, Footer |
| Mobile menu | The "Menu" / "Close" panel with focus trap and Escape (v3 Section 6.2) |
| Responsive | 375, 768, 1024, 1440 px layouts as in v3 Section 11.2 |
| Design system | Tokens, type scale, spacing scale, and the components the homepage needs (v3 Sections 4 and 9) |
| Accessibility | WCAG 2.2 AA behavior for everything on the page |
| Motion | Only what v3 Section 10 allows |
| Images | Placeholder photos, stored locally, with a manifest and attributions (Section 6) |
| Stand-in pages | One shared "Not part of the preview" page and the 404 (Section 3.3) |

### 2.2 Do NOT build

| Not built | Reason |
|---|---|
| Admin dashboard, login page, hidden route, `ADMIN_PATH` | Out of scope for the preview. |
| Backend of any kind: database, ORM, migrations, API routes, server actions, authentication, sessions, uploads, email, rate limiting | Out of scope. No `DATABASE_URL`, no `.env` needed. |
| Cart logic, checkout, orders, shipping calculation, stock | The preview has no real shopping behavior. |
| Shop page, product page, content pages (About, Help, Privacy and so on) | Later phase. Links to them lead to the stand-in page. |
| Sitemap, robots, JSON-LD, analytics, SEO beyond title and description | Later phase. |
| Arabic, RTL, IBM Plex Sans Arabic | The dashboard is the only Arabic part, and it is not in this preview. |
| Tests beyond the smoke and accessibility checks in Phase F7 | Money and stock logic does not exist yet. |

---

## 3. Preview rules (what is different from the full MVP)

### 3.1 Content lives in one file

The MVP brief forbids hardcoded content. That rule exists because the real site reads content from a database. For this preview there is no database, so:

1. All homepage content lives in **one typed file**: `src/content/home.ts`.
2. The **shapes** in that file mirror the `home_sections` config shapes of the MVP brief (Section 3.3 there): `hero`, `drop`, `brand_story`, `quality`, `lookbook`, `signup`. Header and footer data mirror `settings` and `nav_items`.
3. **No marketing copy, image path, price, phone number, or link is written inside a component.** Components receive props only. Later, swapping `home.ts` for database reads must not require editing any component.
4. Interface labels (button text, field labels, messages) live in `src/lib/ui-strings.ts`.
5. Every demo value in `home.ts` carries a `demo: true` marker so it is easy to find and replace.

### 3.2 Behavior without a backend

| Element | Preview behavior |
|---|---|
| Signup form | Validates the email format in the browser, then shows the success message. **It stores and sends nothing.** A visible developer note in the README states this. |
| Category links in The Drop | Filter the 4 demo products in the browser. The current one is marked "Selected" (v3 Section 4.4). Replaced by real links in the full build. |
| "Cart (n)" in the header | Shows "Cart (0)" and links to the stand-in page. It is a visual element only. |
| Product cards, "View all", nav links, policy links | Link to the stand-in page (Section 3.3). |
| WhatsApp, Instagram, email | Demo placeholders from `home.ts`. WhatsApp opens `https://wa.me/` with the demo number. |

### 3.3 Stand-in pages (no dead buttons)

Every link must go somewhere that makes sense.

- A catch-all route renders a short page: the logo mark, the line "This page is not part of the preview yet.", and a text link "Back to home".
- `/404` follows v3 Section 5.1: the orbit mark and a link home.
- No other pages are built.

### 3.4 Stack for the preview

| Item | Choice |
|---|---|
| Framework | Next.js (current stable, App Router), TypeScript strict. Same as the MVP brief, so the preview can grow into the real site. |
| Server code | **None.** No route handlers, no server actions, no database packages. Static rendering only. `output: "export"` is optional if it makes previewing easier. |
| Styling | Tailwind CSS with **only** the v3 Section 4 tokens in the theme |
| Fonts | Archivo and Inter, self-hosted WOFF2, Latin only. The `@fontsource-variable` packages are acceptable because they ship the files with the build. Do not load fonts from a font CDN. |
| Icons | None, except the "Close" mark in the mobile menu, which always has the visible text "Close" beside it. |
| Images | `next/image` with local files in `public/preview-images/` |
| Animation libraries | None. CSS transitions only. |
| Tooling | ESLint, Prettier optional. Playwright and axe-core for Phase F7 only. |

---

## 4. Design plan

Colors, type, spacing, and components follow v3 exactly. This section records the design intent so the build stays consistent.

### 4.1 Tokens (from v3 Section 4, do not change)

| Token | Hex | Use |
|---|---|---|
| `--obsidian` | `#080808` | Text on light. Hero panel and footer background. Primary button on light. |
| `--off-white` | `#F4F1EB` | Default page background. Text on dark. |
| `--charcoal` | `#242424` | Raised dark surfaces and dividers on dark. |
| `--concrete` | `#929292` | Secondary text on dark only. |
| `--graphite` | `#5E5E5E` | Secondary text and control borders on light. |
| `--line-light` | `rgb(8 8 8 / 0.14)` | Dividers on light. |

No gradients, no shadows, no blur, no other colors. Radius 0 for images and 2px for buttons and inputs.

### 4.2 Type roles

| Role | Family | Use on the homepage |
|---|---|---|
| Display and headings | Archivo, 600 to 800 | Hero headline (uppercase, up to 96px), section headings |
| Body and UI | Inter, 400 to 600, tabular numerals for prices | Everything else |
| Label | Inter 600, 12px, uppercase, letter-spacing 0.18em | Hero label, status labels, spec labels |

The page's personality comes from **scale contrast**: very large display type beside very small tracked labels, echoing the logo (`TERRA` small, `HOP` large).

### 4.3 Layout concept

The page is **light by default**. Dark appears only in the hero panel and the footer. Layouts are asymmetric where v3 says so. One element carries the page: the hero.

Desktop (1024 px and up), simplified:

```
+--------------------------------------------------------------+
| HEADER  logo        Shop  About  Help            Cart (0)    |  Obsidian over hero
+------------------------------------+-------------------------+
|                                    |  DROP 01                |
|                                    |                         |
|        HERO IMAGE (7/12)           |  BLACK                  |  Obsidian panel (5/12)
|        portrait photo              |  OVERSIZED TEE          |  no text over the photo
|                                    |  Preorder open          |
|                                    |  [ Preorder ]           |
+------------------------------------+-------------------------+
|  The Drop      All  T-shirts  Hoodies               View all |  Off-White
|  [card] [card] [card] [card]       4 columns                 |
+--------------------------------------------------------------+
|  Oversized streetwear for young men... (5/12) | image (7/12) |  Brand Story
+--------------------------------------------------------------+
|  Details                                                     |
|  Fit ........ Oversized        1 Place your order            |  Quality and Details
|  Release .... Small drops      2 We confirm                  |
|                                3 Delivery                    |
+--------------------------------------------------------------+
|  Lookbook   [ tall ] [ wide  ] [ tall ]   asymmetric grid    |
|             [ wide ] [ tall  ]                               |
+--------------------------------------------------------------+
|  Stay in the loop.   [ email ]  [ Sign up ]                  |  Signup
+--------------------------------------------------------------+
| FOOTER (Obsidian)  mark  links  contact  (c) TERRA HOP       |
|                    Higher on Purpose.                        |
+--------------------------------------------------------------+
```

Mobile (below 768 px): everything stacks. The hero shows the image first (4:5), then the Obsidian panel. The Drop is 2 columns. The header collapses to the logo, "Cart (0)", and a "Menu" button.

### 4.4 Principles

1. **Restraint.** Few colors, few components, few animations. White space is structural.
2. **Honesty.** No fake reviews, counters, scarcity, countdowns, or product claims, in code or copy.
3. **Precision.** Real structure, exact prices format ("EGP 650"), consistent spacing from the 4px scale only (4, 8, 12, 16, 24, 32, 48, 64, 96, 128).
4. **No text over photos. No emoji anywhere.** The numbered steps in "Product Quality and Details" are allowed because the content really is a sequence.
5. **One memorable thing.** The hero. Everything else stays quiet.

---

## 5. Section specifications and demo content

Layout details follow v3 Section 6. Demo copy comes from the MVP brief Section 8.2 and is **placeholder text with no factual claims**.

### 5.1 Header

| Item | Specification |
|---|---|
| Content | Logo (inline SVG, `currentColor`), links Shop, About, Help, and "Cart (0)". |
| Logo | If the logo files exist in `public/logo/`, inline `terra-hop-logo-currentcolor.svg`. If they do not exist, build a **temporary CSS wordmark** (`TERRA` small and tracked above a heavy `HOP`) and record this in `DECISIONS.md`. |
| Height | 56 px mobile, 64 px desktop. Solid background (Obsidian over the hero, Off-White elsewhere). Not sticky. |
| Mobile menu | Text button "Menu" opens a full-height panel with the same links plus WhatsApp. "Close" button, focus trapped while open, Escape closes, focus returns to the "Menu" button. Slide or fade, 200 ms. |
| Skip link | "Skip to content" as the first focusable element. |

### 5.2 Hero

| Item | Specification |
|---|---|
| Layout | Stacked on mobile (image first, 4:5). Two columns from 1024 px: image 7 of 12, **solid Obsidian text panel** 5 of 12, height up to 80% of the viewport. |
| Content | Label "Drop 01". Display headline "Black Oversized Tee". Status line "Preorder open". One button "Preorder". |
| Image | Slot `hero`, 4:5, real `<img>` through `next/image` with `priority`, explicit width and height, never lazy. |
| Rules | No text over the photo. No video, carousel, countdown, or discount banner. One button only. |

### 5.3 The Drop

| Item | Specification |
|---|---|
| Heading | "The Drop". Optional "View all" text link. |
| Category row | Text links "All", "T-shirts", "Hoodies". The current one is marked "Selected". |
| Grid | 2 columns on phones, 3 from 768 px, 4 from 1024 px. |
| Card | 4:5 image, name, price, status label. The whole card is one link. A second image cross-fades on hover, **only on hover-capable devices** (200 ms). |

Demo products (all prices are placeholders):

| Product | Category | Price | Status label | Images |
|---|---|---|---|---|
| Black Oversized Tee | T-shirts | EGP 650 | Preorder | `tee-black-1`, `tee-black-2` |
| Off-White Graphic Tee | T-shirts | EGP 650 | none | `tee-offwhite-1`, `tee-offwhite-2` |
| Black Oversized Hoodie | Hoodies | EGP 1,100 | none | `hoodie-1`, `hoodie-2` |
| Washed Grey Tee | T-shirts | EGP 600 | none | `tee-grey-1`, `tee-grey-2` |

Prices use `Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 })` with a fallback format "EGP 1,100" if the browser output differs.

Empty state (when the filter returns nothing or there are no products): "The first drop is coming soon."

### 5.4 Brand Story

| Item | Specification |
|---|---|
| Layout | Text 5 columns, image 7 columns from 1024 px. Stacked below. |
| Heading | "Oversized streetwear for young men in Egypt." |
| Body | "TERRA HOP releases small drops. Every piece is confirmed by preorder before production." |
| Image | Slot `story`. |

### 5.5 Product Quality and Details

| Item | Specification |
|---|---|
| Heading | "Details" |
| Spec rows | "Fit" = "Oversized". "Release" = "Small drops, confirmed by preorder". The block hides itself if there are no rows. |
| Ordering steps | (1) "Place your order": "Add pieces to your cart and place your order." (2) "We confirm": "We contact you by phone or WhatsApp to confirm." (3) "Delivery": "Your order is delivered. Preorder pieces ship when production is complete." |
| Link | A text link to the shop (leads to the stand-in page). |

### 5.6 Editorial Lookbook

| Item | Specification |
|---|---|
| Heading | "Lookbook" |
| Images | 5 images, slots `look-1` to `look-5`, each with alt text written from what the image shows. Two of them link to a demo product. |
| Layout | Asymmetric 12-column grid from 1024 px, 3 columns from 768 px, 2 columns below. No carousel. No captions. No text over images. |
| Rule | The section hides itself below 3 images. |

### 5.7 Community Signup

| Item | Specification |
|---|---|
| Content | Heading "Stay in the loop." Sentence "Get notified about the next drop." Email field with a visible label. Consent line "By signing up you agree to our Privacy page." Button "Sign up". Text links to Instagram and WhatsApp. |
| Behavior | See Section 3.2. Inline error "Error: enter a valid email address." under the field, with a 2px Obsidian border. Success: "Thank you. You are on the list." Honeypot is **not** needed in the preview. |
| Not shown | Subscriber counts or any claim about community size. |

### 5.8 Footer

| Item | Specification |
|---|---|
| Surface | Obsidian background, Off-White text, Concrete for secondary text (14 px and above). |
| Content | Orbit mark (once on the page, v3 Section 3.5), column 1: Shop, About, Help. Column 2: Shipping and Returns, Privacy, Terms. WhatsApp `+20 100 000 0000`, email `hello@example.com`, Instagram text link (all demo). Copyright `© {year} TERRA HOP` with the year computed at render. Tagline "Higher on Purpose." |
| Excluded | Payment logos, badges, "Cash on delivery" line. |

---

## 6. Images

The owner asked to see the project with images. For the preview, **placeholder photos are fine**, with the honesty rule from the MVP brief: they do not show the real product and are removed before launch.

### 6.1 Image slots (15 images)

| Slot | Used by | Orientation | Search query |
|---|---|---|---|
| `hero` | Hero | Portrait 4:5 | `man wearing black oversized t-shirt studio` |
| `tee-black-1`, `tee-black-2` | Black Oversized Tee card | Portrait 4:5 | `black oversized t-shirt flat lay`, `man black oversized tee` |
| `tee-offwhite-1`, `tee-offwhite-2` | Off-White Graphic Tee card | Portrait 4:5 | `white oversized t-shirt flat lay`, `man white oversized tee` |
| `hoodie-1`, `hoodie-2` | Black Oversized Hoodie card | Portrait 4:5 | `black hoodie flat lay`, `man black oversized hoodie` |
| `tee-grey-1`, `tee-grey-2` | Washed Grey Tee card | Portrait 4:5 | `grey t-shirt flat lay`, `man grey oversized tee` |
| `story` | Brand Story | Landscape or portrait | `minimal clothing rack neutral background` |
| `look-1` to `look-5` | Lookbook | Portrait 4:5 | `streetwear monochrome street style man`, `oversized fit urban`, `black outfit streetwear`, `streetwear sneakers urban`, `oversized hoodie street` |

### 6.2 How to source them (in this order)

1. **Free-license sites** (Unsplash, Pexels, Pixabay). Choose by the photography direction in v3 Section 3.4: light neutral backdrop for product shots, plain or monochrome garments, no visible brand names or logos, no text in the image.
2. **Verify every image** before use: HTTP 200, `Content-Type` starting with `image/`, long edge at least 1080 px.
3. **Download it** into `public/preview-images/{slot}.jpg`. The site must keep working if the source link dies. Do not hotlink.
4. If a slot fails after 3 attempts, use `https://picsum.photos/seed/terra-{slot}/1080/1350`, download it the same way, and note it in the manifest.
5. If even that fails, generate a neutral grey SVG tile at 4:5 for that slot and note it.

### 6.3 Files to produce

| File | Content |
|---|---|
| `src/content/images.ts` | For each slot: local path, width, height, alt text. Components read this, never a literal path. |
| `preview-images/MANIFEST.md` | For each slot: source page, direct URL, photographer, license name, fallback used (if any). |
| `preview-images/ATTRIBUTIONS.md` | Photographer, source page, and license for every photo. |

### 6.4 Alt text

Write it after looking at the image. Describe garment, view, and context. Example pattern: "Black oversized T-shirt, front view, laid flat on a light surface". Do not start with "Image of". Decorative images use an empty `alt`. No emoji.

---

## 7. Build phases

Finish and verify each phase before the next. After every phase: typecheck, lint, build, start the app, check in a browser, fix, report.

| # | Phase | Work | Done when |
|---|---|---|---|
| **F0** (done) | Project setup | Create the Next.js app (TypeScript strict). Tailwind theme with the v3 Section 4 tokens only. Self-host Archivo and Inter. Add `public/logo/` if the logo files are present. Create `README.md` (run in three commands) and `DECISIONS.md`. | `npm run dev` shows one styled blank page in the right fonts and colors. Typecheck, lint, and build pass. |
| **F1** (done) | Foundations | Type scale, spacing scale, container (max 1280 px) and gutters (16, 24, 40), 4, 8, and 12-column grid. Components: Button (primary, secondary), Text input, Label, Status label, Divider, Container, Skip link. Focus ring and disabled rules from v3 Section 4.4. `src/lib/ui-strings.ts`. | A temporary internal page lists every component in every state. It is deleted at the end of F8. Contrast verified on real pairs. |
| **F2** (done) | Content and images | `src/content/home.ts` with typed shapes. `src/content/images.ts`. Source, verify, and download the 15 images. Manifest and attributions. Zod is **not** needed. Plain TypeScript types are enough. | Every slot has a local image with alt text. The manifest lists all 15. No literal path in any component. |
| **F3** (done) | Header, footer, menu | Header (desktop and mobile), the "Menu" panel with focus trap, footer, stand-in page, 404. Logo or temporary wordmark. | Keyboard-only pass works: skip link, menu open and close, Escape, focus returns. All links land somewhere sensible. |
| **F4** (done) | Hero and The Drop | Hero (image plus Obsidian panel, art direction by breakpoint). Product card, category row with the "Selected" state, grid, hover second image (hover-capable only), empty state. | The hero image is the Largest Contentful Paint element. The card grid is 2, 3, and 4 columns at the right widths. No layout shift. |
| **F5** (done) | Remaining sections | Brand Story, Product Quality and Details, Lookbook (asymmetric grid, hides below 3 images), Community Signup (client-side validation and messages). | All 8 sections render in order from `home.ts`. Emptying a section's content in `home.ts` hides that section without breaking the page. |
| **F6** (done) | Page assembly and metadata | Compose the homepage from the content file. Page title "TERRA HOP" and a description built from the brand positioning. `lang="en"`, `dir="ltr"`. | The page reads top to bottom as designed. No console errors. |
| **F7** (prepared, not run) | Quality pass | Playwright screenshots at 375, 768, 1024, and 1440 px. axe-core run on the homepage with zero violations. Keyboard-only pass. 200 percent zoom and 320 px reflow check. `prefers-reduced-motion` check. Lighthouse mobile run. | Section 11 of v3 holds. No horizontal scroll. Reported Lighthouse scores are pasted in `DECISIONS.md` as measured values, not claims. |
| **F8** (written) | Review package | Delete the internal component page. Final `README.md`. Screenshots saved to `review/screenshots/`. Optional: deploy the static build to a Vercel preview URL if the owner's account is connected. A short `REVIEW.md` listing what was built, what is placeholder, and what is intentionally missing. | The owner can run three commands and see the homepage. `REVIEW.md` is complete. |

### 7.1 Performance targets for the preview

| Metric | Target |
|---|---|
| Largest Contentful Paint | 2.5 s or less on a throttled mobile profile |
| Cumulative Layout Shift | 0.1 or less |
| JavaScript on the homepage | Keep it light. No animation or UI libraries. Client JavaScript only for the menu, the category filter, and the signup form. |
| Fonts | Two variable families, Latin subset, `font-display: swap`, preload only the Archivo file used above the fold |
| Hero image (mobile) | About 150 KB or less after optimization |

These are targets to measure, not claims. Report real numbers.

---

## 8. Review and iteration

### 8.1 What the owner reviews

1. The homepage on a phone-width window and on desktop.
2. Whether the hero, the drop grid, and the lookbook feel right for the brand.
3. Whether the copy, order of sections, and amount of white space are right.
4. Whether the colors and type feel like TERRA HOP. (Colors are locked by the owner's earlier decision. A change here needs an explicit request.)

### 8.2 Feedback checklist the owner can answer in a few lines

| Question | Answer |
|---|---|
| Overall | Approved or needs changes |
| Sections to change | Name the section and what to change |
| Sections to remove or reorder | List |
| Photos | Which slots feel wrong and what kind of photo you want |
| Copy | Any wording to change |
| Anything missing | List |

### 8.3 Iteration rules

1. Each round changes **only** what the owner lists.
2. Content and image changes touch `home.ts` and `images.ts` only.
3. Layout changes touch the affected section component only.
4. After each round, re-run the F7 checks that the change could affect and report the result.
5. A round ends with updated screenshots in `review/screenshots/`.

---

## 9. Decisions made (do not ask)

| Topic | Decision |
|---|---|
| Scope | Homepage only, 8 sections, no backend, no admin, no login. |
| Framework | Next.js with TypeScript, static rendering, no server code. |
| Content source | One typed file, `src/content/home.ts`, shaped like the future database config. |
| Images | Free-license placeholders, downloaded into `public/preview-images/`, with manifest and attributions. Fallback chain in Section 6.2. |
| Logo | Use `public/logo/` if present. Otherwise a temporary CSS wordmark, recorded in `DECISIONS.md`. |
| Other pages | One shared stand-in page and the 404. |
| Signup | Validates in the browser, stores nothing, shows the success message. |
| Cart | "Cart (0)", link to the stand-in page. |
| Language | English, LTR, strings in `ui-strings.ts`. |
| Colors and fonts | Exactly as v3 Section 4. |
| Demo data | All prices, contact details, and links are placeholders marked `demo: true`. |
| Anything else | The simplest option that fits this plan, recorded in `DECISIONS.md`. |

---

## 10. If the owner approves: what carries into the full MVP

| Carries over unchanged | Replaced in the full build |
|---|---|
| Tokens, fonts, Tailwind theme | `home.ts` becomes database reads (`home_sections`, `settings`, `nav_items`) |
| All section components and the card, button, and input components | Signup form posts to a server action and stores subscribers |
| `ui-strings.ts` | Category links become real links to the shop |
| Layout, spacing, responsive behavior, accessibility work | "Cart (0)" reads the real server-side cart |
| Image `alt` conventions | Placeholder images are deleted and replaced from the dashboard |
| Stand-in page and 404 | Stand-in page is removed as real pages are built |

The full build then continues from milestone M0 of `Terra_Hub_MVP_Plan.md`, reusing the finished frontend, with M4 (homepage engine) and M5 (storefront) adapted to the existing components.

---

## 11. Acceptance checklist for this preview

- [ ] The homepage shows the 8 sections in order, and no others.
- [ ] Colors are exactly the v3 tokens. No gradients, no shadows, no emoji.
- [ ] No text sits over any photo.
- [ ] The hero has one button and a solid Obsidian text panel beside the image.
- [ ] No copy, price, link, phone number, or image path is written inside a component. It all comes from `home.ts`, `images.ts`, or `ui-strings.ts`.
- [ ] All 15 images are stored locally with alt text, a manifest, and attributions.
- [ ] There is no backend code, no API route, no database package, and no environment variable.
- [ ] Every link and button leads somewhere sensible or does something visible.
- [ ] The page works at 320, 375, 768, 1024, and 1440 px with no horizontal scroll.
- [ ] A keyboard-only pass of the whole page works, including the menu.
- [ ] Axe reports zero violations on the homepage.
- [ ] `prefers-reduced-motion` removes all transitions.
- [ ] `REVIEW.md` and `review/screenshots/` exist.

---

## 12. Progress log

| Phase | Status | Date |
|---|---|---|
| F0 Project setup | **Done** | 2026-10-28 |
| F1 Foundations | **Done** (code written, not yet built or tested) | 2026-10-29 |
| F2 Content and images | **Done** (no stock photos, gray placeholder tiles) | 2026-10-29 |
| F3 Header, footer, menu | **Done** (code written, not yet built or tested) | 2026-10-29 |
| F4 Hero and The Drop | **Done** (code written, not yet built or tested) | 2026-10-29 |
| F5 Remaining sections | **Done** (code written, not yet built or tested) | 2026-10-29 |
| F6 Page assembly and metadata | **Done** (code written, not yet built or tested) | 2026-10-29 |
| F7 Quality pass | **Prepared, not run.** Tests are written. Results must come from a machine with network and a browser | 2026-10-29 |
| F8 Review package | **Written.** `REVIEW.md`, final `README.md`, `review/screenshots/` (empty until tests run). Foundations page deleted. Measured results not filled in | 2026-10-29 |

**Important:** the build environment for F1 and F2 had no network, so `npm install`, typecheck, lint, build, and browser checks were **not run**. First thing to do on your machine: `npm install && npm run typecheck && npm run lint && npm run build`, then `npm run dev` and open `/` and `/foundations`.

### 12.1 Phase F0: what was built

| Item | Result |
|---|---|
| Project | Next.js 16.4.3, App Router, TypeScript strict, ESLint. Source under `src/`. Delivered as `terra-hop-frontend-f0.zip` (no `node_modules`). |
| Tokens | The five brand colors and `--color-line-light` in `src/app/globals.css` through Tailwind `@theme`. The default Tailwind palette, shadows, drop shadows, and blur are reset, so no other color or shadow compiles. Semantic variables `--bg`, `--fg`, `--fg-muted`, `--border`, `--radius` and the `.on-dark` class follow v3 Section 4.5. Radius utility: `rounded-control` (2px). |
| Fonts | Archivo (with the width axis) and Inter, Latin, variable WOFF2, self-hosted in `src/fonts/` with their OFL licenses. Loaded with `next/font/local`, `font-display: swap`, size-adjusted fallbacks. Only Archivo is preloaded. |
| Base styles | Light page by default, 16 px body at 1.6 line height, 2 px focus outline with 2 px offset, all transitions removed under `prefers-reduced-motion`. |
| Layout | `lang="en"`, `dir="ltr"`. Title "TERRA HOP". |
| Strings | `src/lib/ui-strings.ts` created. The page text comes from it. |
| Setup-check page | A temporary page at `/` showing the Archivo display headline, Inter body text, and the five color tokens with names in text. Replaced in Phase F6. |
| Logo | `public/logo/` created and empty. The logo zip was not received. |
| Docs | `README.md` (run in three commands, scripts, structure) and `DECISIONS.md` (12 decisions). |
| Scripts | `dev`, `build`, `start`, `lint`, `typecheck`. |

### 12.2 Phase F0: checks and results

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, no warnings |
| `npm run build` | Passed. Both routes prerendered as static. |
| `npm run dev` | Served the page with HTTP 200 |
| Production server | Served the page. Archivo is preloaded through the HTTP `Link` header. |
| Browser check (headless Chromium, 375 px and 1440 px) | Heading renders in Archivo at weight 800 and width 125%. Body renders in Inter. Both fonts report as loaded. Page background measured `rgb(244, 241, 235)` and text `rgb(8, 8, 8)`, matching Off-White and Obsidian. No horizontal scroll. No console errors. |
| Screenshots | Reviewed at 1440 px. The 375 px result was verified by measurement, not by eye. |

Not verified in F0: contrast on every pair (Phase F1), keyboard behavior (no interactive controls exist yet), performance numbers (Phase F7).

### 12.3 Deviations and open items

| # | Item | Detail | Decision needed |
|---|---|---|---|
| 1 | Tailwind version | The scaffold installs Tailwind v4, which has no `tailwind.config` file. Tokens are in CSS. The effect is the same as the plan: only the v3 colors exist. Token variable names are `--color-obsidian` and so on instead of `--obsidian`. | None |
| 2 | Logo files | `terra-hop-logo-svg.zip` was not available. Phase F3 will use a temporary CSS wordmark unless the files are placed in `public/logo/` first. | Send the zip if you want the real logo in the preview |
| 3 | Font weight | Archivo with the width axis is 90 KB and Inter is 48 KB, 138 KB in total, against the v3 estimate of 100 KB. A weight-only Archivo would be 35 KB but loses the wide display setting. | None now. Measured and revisited in Phase F7. |
| 4 | Scaffold defaults | Next 16.4.3 enables Cache Components and partial prefetching by default. They do not affect a static homepage. | None |

### 12.5 Phase F1: what was built

| Item | Result |
|---|---|
| Type scale | Utilities `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-label` in `globals.css`. |
| Layout | `Container` (max 1280 px, gutters 16/24/40) and `Grid` (4, 8, 12 columns). |
| Components | `Button` and `ButtonLink` (primary, secondary, disabled), `TextInput` with error state, `FieldError`, `Label`, `StatusLabel`, `Divider`, `SkipLink`, `Logo`. They use semantic variables, so they work on light and inside `.on-dark`. |
| Contrast (computed) | Obsidian/Off-White 17.77, Graphite/Off-White 5.75, Concrete/Obsidian 6.44, Concrete/Charcoal 4.99, Off-White/Charcoal 13.77. The hero tint pair is measured in F7. |
| Internal page | `/foundations` lists every component in light and dark. Deleted at the end of F8. |
| Logo | Owner's logo converted to a white-on-transparent PNG, drawn with a CSS mask so it follows `currentColor`. Replace with a vector SVG when available. The orbit mark alone is not separated yet. |
| Hero (drafted early) | Per owner request, a full-bleed hero like the Peso Studios reference: owner's photo, large logo over it, nav on top, "Drop 01 / Preorder open" and one outlined button at the bottom-left, flat Obsidian 45% tint, no gradient. **This overrides Section 5.2 and the "no text over photos" rule for the hero only.** Recorded as decision 13. |

### 12.6 Phase F2: what was built

| Item | Result |
|---|---|
| `src/content/home.ts` | All 8 sections of content with `demo: true`: header, hero, drop (4 products), brandStory, quality, lookbook, signup, footer. |
| `src/content/images.ts` | 15 slots plus the logo, with paths, sizes, and alt text. |
| Images | **No stock photos** (owner decision). `hero.jpg` is the owner's photo. The other 14 slots are flat gray 4:5 tiles. Replace a file with the same name to swap it. |
| Manifest | `public/preview-images/MANIFEST.md` and `ATTRIBUTIONS.md`. |
| Known gap | All links point to `/not-in-preview`, which becomes a real page in F3. Until then they show a 404. |

### 12.7 Open items

| # | Item | Needed from the owner |
|---|---|---|
| 1 | Product, story, and lookbook photos | Send them (4:5, 1080 px or more on the long edge) when ready. Name them by slot (see `MANIFEST.md`). |
| 2 | Vector logo (SVG) | Optional. Better quality than the PNG. |
| 3 | Orbit mark alone | Optional. Needed for the footer and the 404. Otherwise F3 uses a crop of the logo. |
| 4 | Hero layout confirmation | Does the hero feel right (logo position, tint strength)? Review after running the project. |

### 12.8 Phase F3: what was built

| Item | Result |
|---|---|
| Header | `src/components/layout/header.tsx`. Overlay mode on the home hero (transparent, white text), solid Off-White mode elsewhere. 56/64 px, not sticky. Links Shop, About, Help and "Cart (0)". |
| Mobile menu | `mobile-menu.tsx` (client). Text buttons "Menu" and "Close", native `<dialog>` for focus trap and Escape, focus returns to "Menu", 200 ms fade, WhatsApp link at the bottom. |
| Footer | `footer.tsx`. Obsidian, logo, tagline, two link columns, WhatsApp, email, Instagram, copyright with the year computed at render. |
| Stand-in page | `/not-in-preview`: logo, "This page is not part of the preview yet.", link home. All demo links now point here. |
| 404 | `not-found.tsx`: logo, message, link home. |
| Skip link | Already in the root layout (F1), targets `#main`. |

Deviations: explicit stand-in route instead of a catch-all, and the full logo instead of the orbit mark alone (decisions 24 and 26).

### 12.9 Phase F4: what was built

| Item | Result |
|---|---|
| Hero | Art-directed with `getImageProps`: 4:5 crop (`hero-mobile.jpg`) on phones, wide photo from 768 px, `priority` preload. Full-bleed layout per the owner's reference. |
| The Drop | `sections/drop.tsx` with heading, "View all" link, category row ("All", "T-shirts", "Hoodies") with a Selected state, and the grid (2 columns, 3 from 768 px, 4 from 1024 px). |
| Product card | `drop/product-card.tsx`. One link, 4:5 image, name, price ("EGP 650"), status label. Second image on hover only. |
| Empty state | "The first drop is coming soon." from `home.ts`. |
| Client JS | Only the category filter (`product-grid.tsx`) and the mobile menu. |

### 12.10 Phase F5: what was built

| Item | Result |
|---|---|
| Brand Story | Text 5 columns, image 7 columns from 1024 px. Stacked below. |
| Product Quality and Details | Spec rows (`dl`), the 3 numbered ordering steps (`ol`), a link to the shop. Hides if empty. |
| Editorial Lookbook | Asymmetric 12-column grid from 1024 px, 3 columns from 768 px, 2 below. Two items link to the stand-in page. Hides below 3 images. |
| Community Signup | Visible label, browser validation, inline error, success message, consent line, Instagram and WhatsApp links. Stores nothing. |
| Homepage | `/` now shows all 8 sections in order: Header, Hero, The Drop, Brand Story, Details, Lookbook, Signup, Footer. |

### 12.11 Phase F6: what was built

| Item | Result |
|---|---|
| Metadata | Title "TERRA HOP" and description "Oversized streetwear for young men in Egypt. Small drops, confirmed by preorder." in `home.meta`. |
| Assembly | The homepage is composed from `home.ts` in plan order. |
| Language | `lang="en"`, `dir="ltr"`. |
| Code review | A static read of all files found one type issue (readonly tuple in `Product.images`), now fixed. A literal scan found no copy, price, path, phone, or link inside components. |

### 12.12 Phases F7 and F8: prepared, not completed

The build environment has no network and no browser. **Nothing from F1 to F6 has been compiled or rendered, so no quality claim can be made yet.** What exists:

| Item | File |
|---|---|
| Playwright config (builds and serves on port 3100) | `playwright.config.ts` |
| Automated checks: no horizontal scroll at 320, 375, 768, 1024, 1440; screenshots at 375, 768, 1024, 1440; axe (WCAG 2.2 AA) zero violations; skip link; menu open, Escape, focus return; category filter; signup validation; reduced motion; stand-in page and 404 | `tests/f7.spec.ts` |
| Command | `npm run test:f7` (first run: `npx playwright install chromium`) |
| Lighthouse mobile | Manual, command in `README.md` |
| Review notes with empty result fields | `REVIEW.md` |

**What to do, in order, on a machine with network:**

1. `npm install`
2. `npm run typecheck && npm run lint && npm run build`, fix any error (likely spots: the footer `"use cache"` year, the `starting:open:` variant on the menu dialog, `getImageProps` with `priority` in the hero).
3. `npm run dev`, look at `/` at phone width and desktop width, and tell me what to change (the review round, Section 8).
4. `npm install` again was done in step 1, now `npx playwright install chromium` and `npm run test:f7`.
5. Run Lighthouse mobile and paste the real numbers in `REVIEW.md` and `DECISIONS.md`.
6. (Done in F8: `src/app/foundations/` is already deleted.)

Not automated, check by eye: a keyboard-only pass, 200 percent zoom, and the contrast of the hero text over the tinted photo.

If you send me the build errors, the test output, or screenshots, I can fix what fails and close F7 and F8 properly.

### 12.13 Acceptance checklist (Section 11), honest status

Legend: **Code** = true by reading the code, not yet observed running. **Pending** = needs a build and a browser.

| Item | Status |
|---|---|
| 8 sections in order, no others | Code |
| Colors only from the v3 tokens, no gradients, shadows, or emoji | Code (Tailwind theme resets other colors). The hero uses a flat tint |
| No text over any photo | **Not met by design for the hero only** (owner request). Everywhere else: Code |
| Hero has one button | Code. The panel is **not** a solid Obsidian side panel, by owner request |
| No copy, price, link, phone, or image path inside a component | Code (literal scan done) |
| All 15 images local with alt text, manifest, attributions | Code. 14 are gray placeholder tiles, 1 is the owner's photo |
| No backend, API route, database package, or env variable | Code |
| Every link and button goes somewhere sensible | Code (all go to `/not-in-preview`, `/`, `wa.me`, Instagram, `mailto:`) |
| Works at 320 to 1440 px with no horizontal scroll | Pending (`npm run test:f7`) |
| Keyboard-only pass including the menu | Pending (automated test plus a human pass) |
| axe zero violations | Pending |
| `prefers-reduced-motion` removes transitions | Code (global rule), Pending (test) |
| `REVIEW.md` and `review/screenshots/` exist | Yes. Screenshots fill when the tests run |

### 12.14 Where to look next

The review round (Section 8) starts when you run the project and send feedback. Send build errors, test output, or screenshots, and the next round fixes only what you list.

### 12.13 Acceptance checklist (Section 11), honest status

Legend: **Code** = true by reading the code, not yet observed running. **Pending** = needs a build and a browser.

| Item | Status |
|---|---|
| 8 sections in order, no others | Code |
| Colors only from the v3 tokens, no gradients, shadows, or emoji | Code (Tailwind theme resets other colors). The hero uses a flat tint |
| No text over any photo | **Not met by design for the hero only** (owner request). Everywhere else: Code |
| Hero has one button | Code. It is **not** a solid Obsidian side panel, by owner request |
| No copy, price, link, phone, or image path inside a component | Code (literal scan done) |
| All 15 images local with alt text, manifest, attributions | Code. 14 are gray placeholder tiles, 1 is the owner's photo |
| No backend, API route, database package, or env variable | Code |
| Every link and button goes somewhere sensible | Code (all go to `/not-in-preview`, `/`, `wa.me`, Instagram, `mailto:`) |
| Works at 320 to 1440 px with no horizontal scroll | Pending (`npm run test:f7`) |
| Keyboard-only pass including the menu | Pending (automated test plus a human pass) |
| axe zero violations | Pending |
| `prefers-reduced-motion` removes transitions | Code (global rule), Pending (test) |
| `REVIEW.md` and `review/screenshots/` exist | Yes. Screenshots fill when the tests run |

### 12.14 What happens next

The review round (Section 8) starts when you run the project and send feedback. Send build errors, test output, or screenshots, and the next round fixes only what you list.
