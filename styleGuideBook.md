# Chirpy Style Guide

This guide records the current frontend design system and the conventions for extending it. It is
for Chirpy's student-facing university review product, not a generic marketing-site template.

## 1. Design principles

- **Make the task obvious.** Put the page purpose and the next useful action first.
- **Earn trust with clarity.** Explain account email verification separately from university
  affiliation verification. Never imply that one proves the other.
- **Use evidence, not decoration.** Do not invent ratings, review counts, student quotes, partner
  logos, or university statistics.
- **Keep the interface quiet.** Use the shared system, real product UI, and restrained color.
  Avoid decorative effects that compete with forms, reviews, or posts.
- **Be inclusive by default.** Semantic HTML, visible focus, readable contrast, reduced-motion
  support, and keyboard operation are requirements, not polish.

## 2. Brand and visual tokens

The current Chirpy UI uses the shared Taste system assets, with its product palette and type set in
`src/modules/auth/view/styles/theme.css`. Use these variables instead of redefining colors or type
inside page rules.

| Role | Token | Current value |
|---|---|---|
| Page background | `--p-bg` | `#ffffff` |
| Secondary surface | `--p-surface` | `#f3f3f3` |
| Main text | `--p-ink` | `#232323` |
| Muted text | `--p-muted` | `#686868` |
| Brand accent | `--p-accent` | `#a1ffcb` |
| Primary action | `--p-action` | `#232323` |
| Primary action text | `--p-action-ink` | `#ffffff` |
| Inverse background | `--p-inv-bg` | `#232323` |
| Inverse text | `--p-inv-ink` | `#ffffff` |
| Inverse action | `--p-inv-action` | `#a1ffcb` |

Use the mint accent sparingly for emphasis and states; it is not the default button fill. Keep
foreground/background contrast sufficient for normal text. Do not introduce a new accent for an
individual page without a product-level design decision.

**Typography**

- Use Manrope for interface and display text. JetBrains Mono is available for code or genuinely
  technical values, not ordinary body copy.
- Body text is 16px by default; keep labels and help text legible.
- Use the system type tokens (`--t-body`, `--t-lead`, `--t-h1`, `--t-h2`, and related tokens)
  before adding page-specific sizes.
- Keep headings direct and sentence case. Avoid all-caps labels, decorative type treatments, and
  text baked into images.

**Shape and spacing**

- The current pages declare `data-radius="soft"` and `data-buttons="solid"`. Keep those page-level
  choices unless the design changes consistently across the product.
- Reuse the radius tokens (`--r-sm`, `--r-md`, `--r-lg`, `--r-btn`) and spacing scale (`--s-1`
  through `--s-10`, based on 4px increments).
- Prefer shared layout tokens over new arbitrary margins, grids, borders, shadows, or radii.
- Use a single shared content edge for adjacent page regions.

## 3. Layout and responsive behavior

- Keep the fixed header consistent: 72px on desktop and 56px on small screens.
- Use the system `.wrap` and its shared width/gutter tokens rather than page-specific container
  widths.
- The auth screen uses a 5:7 introduction/form split on wide screens. It stacks at tablet widths;
  the form becomes one column on narrow screens.
- Keep content in normal document flow. Do not overlap controls, hide content behind fixed UI, or
  make a screen depend on a specific viewport height.
- Build and inspect at 1440px, 1024px, 768px, 390px, and 320px. Desktop-only polish is not complete
  until the narrow layout also works.
- Use the shared system breakpoints (639px and 1023px) for new layouts. Keep an auth-specific
  breakpoint only when it solves a real layout need.

## 4. Components and states

**Actions and links**

- Use the system `.btn--primary` for the main action and `.btn--secondary` for supporting actions.
- Keep buttons at least 44px high; form controls are 48px high in the auth flow.
- Use a clear verb for an action and avoid adding competing primary buttons to one view.
- Links must look and behave like links. Preserve the shared underline, hover, and focus treatment.

**Forms**

- Every input has a visible label; placeholders are not labels.
- Keep help and field-specific errors next to the relevant field. Set `aria-invalid` and connect
  messages with `aria-describedby`.
- Provide a status message for async submission, success, and failure. Do not show success before
  the server confirms the operation.
- Keep loading and unavailable states explicit; do not make a failed request look like an empty
  but successful result.

**Tabs, panels, and feedback**

- Preserve the tab roles, `aria-selected`, `aria-controls`, and keyboard behavior.
- Use the HTML `hidden` attribute for inactive panels and ensure hidden controls are not focusable.
- Use the existing status colors and `data-state` convention for feedback; avoid color as the only
  signal.

## 5. Motion and accessibility

- Keep the shared `assets/motion` layer enabled and prefer its existing interaction hooks over
  page-specific animation.
- Motion should clarify a state change, not delay the task. Avoid scroll-triggered reveals,
  parallax, auto-rotating content, and animation on form fields.
- Respect `prefers-reduced-motion`; the interface must remain complete and understandable without
  motion.
- Every interactive control needs a visible focus state and an accessible name. Preserve the skip
  link, heading order, appropriate image alt text, and keyboard access.
- Do not remove outlines or override shared focus and motion styles without an equally accessible
  replacement.

## 6. Content and product visuals

- Use plain language that tells students what a control or page does.
- Keep account authentication, primary-email verification, and university verification distinct in
  labels and help text.
- Do not expose a review or post author's identity in public-facing UI.
- Show real product functionality where a visual helps. Do not add a generic dashboard mockup,
  stock imagery presented as Chirpy's product, or invented social proof.
- For account and review workflows, prioritize form clarity and the task flow over marketing
  effects or cinematic sections.

## 7. Frontend file organization

Keep static HTML entry points at the view root because Express serves that directory directly.
Group implementation by responsibility:

```text
src/modules/auth/view/
  index.html
  verify-email.html
  assets/                  # shared Taste system, motion, and brand assets
  styles/
    theme.css              # shared Chirpy palette and typography tokens
    auth.css               # auth-page layout and component styles
  scripts/
    auth-page.js           # auth page orchestration
    verify-email-page.js   # verification page behavior
    university-departments.js
    shared/
      api.js               # shared JSON POST handling
      form-validation.js   # shared client-side field validation
```

- Keep shared tokens and behavior in one place. Keep page-specific selectors under that page's
  stylesheet and namespace them with the page/component class.
- Page controllers wire UI events together; feature modules own their specific behavior; shared
  helpers handle behavior used by multiple pages.
- Prefer small ES modules with clear exports. Avoid global functions, duplicated request logic, and
  abstractions used by only one trivial call site.
- Keep HTML as the source of truth for content and accessible relationships. Keep styling out of
  inline attributes and scripts out of markup except for required early page initialization.
- Apply SOLID pragmatically: give each module one clear responsibility and depend on shared
  contracts/helpers, without introducing unnecessary classes or layers.

## 8. Change and review checklist

Before adding or changing a page:

1. Identify the user task, required data, and loading, empty, error, and success states.
2. Reuse the current tokens and components; record any deliberate system-level change here.
3. Keep the markup semantic and the JavaScript split along responsibility boundaries.
4. Verify local asset paths, keyboard flow, focus visibility, contrast, and reduced motion.
5. Inspect the page at the widths listed above and check that all controls remain usable.
6. Run the smallest relevant test/build checks and review the diff for unrelated changes.

