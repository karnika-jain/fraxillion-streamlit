# Stripe reference analysis

This document records the layout logic studied for the landing page and, just as importantly, what was deliberately not copied. The goal was a credible fintech marketing surface for a fraud-investigation product, not a Stripe clone.

## 1. What was studied

The reference pattern is the Stripe-style product homepage:

1. A restrained top navigation with a wordmark, a small set of product/resource links, a secondary text action and one primary CTA.
2. A centered hero with a short eyebrow, a large two-line proposition, a concise supporting sentence, two actions and a wide product visual below.
3. A thin proof or capability strip immediately under the hero.
4. A workflow section that pairs a left-hand stage list with a right-hand detail panel, rather than a row of generic feature cards.
5. Alternating evidence/infrastructure sections with code, diagrams or a product surface treated as the visual object.
6. A feature grid with a small number of strong claims, each attached to a specific product detail.
7. A metrics band with carefully chosen numbers and caveats.
8. A final CTA inside a contained surface, followed by a structured footer.

The useful part is the **rhythm**: dense explanation, a quiet visual, one strong claim, then a moment of evidence. It is not the specific gradient, the illustration style or the copy.

## 2. What the Fraxillion landing page borrows

### Navigation

- Wordmark left; four section links; theme control, design reference and a primary “Proceed to use” action right.
- The mobile menu collapses to a real button with `aria-expanded` and a labelled navigation region.
- The nav is sticky but restrained: one hairline border, a translucent page background and no floating glass panel.

### Hero

- A single proposition with a short italic serif emphasis: **“Follow the money. Keep the proof.”**
- A short line of supporting copy and two actions: **Proceed to use** and **Walk the workflow**.
- A large product visual built from the actual console UI, not an abstract illustration. The visual shows a case, graph and risk dial so the promise is visible immediately.
- A small synthetic-data note under the visual, before any claim is made.

### Workflow

- A seven-stage list on the left and a detail panel on the right. Selecting a stage changes the explanation, bullets, evidence line and CTA.
- This mirrors the source Streamlit workflow rather than inventing a new narrative.
- On narrow screens the selector becomes a horizontal/wrapped control and the detail remains readable.

### Integrity section

- The evidence argument is shown as a real chain: file hash, previous hash, item hash, genesis, verified/mismatch states.
- The demonstration talks about one-byte changes and names the exact failing item, rather than claiming “bank-grade security”.
- A clear caveat distinguishes tamper-evident from tamper-proof.

### Feature grid

- A small number of claims anchored to actual interface fragments: threshold exploration, money-trail graph, evidence chain, two-name decision gate and keyboard-first navigation.
- No generic “AI-powered” card, no sparkle icon and no fabricated customer logo.

### Metrics band

- Uses the source model's evaluated metrics with a visible **synthetic holdout** caveat.
- The numbers are not presented as production performance and there is no invented customer count, volume or savings figure.

### Boundaries and final CTA

- A dedicated dark-pine section states what the demo does **not** claim: no live feed, no regulator transmission, no real IAM, no fabricated customer data.
- The final CTA repeats the two product actions and links to the design reference.

## 3. What was deliberately not copied

| Reference pattern | Decision |
| --- | --- |
| Stripe's wordmark, product names, copy or illustrations | Not used. Fraxillion has its own name, copy and UI-derived visuals. |
| Stripe's fonts | Not used. The UI uses Geist and Geist Mono; emphasis uses Instrument Serif italic. |
| The signature purple/blue gradient | Not used. The atmosphere is warm paper, soft sage and a deep pine accent. |
| Blurred glass cards or floating translucent panels | Not used. Surfaces are opaque with one border and a restrained shadow. |
| Fake customer logos, quotes, ratings or “trusted by” rows | Not used. The page states that it is a synthetic demonstration. |
| Generic feature-card grid with unrelated decorative icons | Replaced with specific console fragments and evidence surfaces. |
| Purple-blue gradient on primary buttons | Primary actions are solid pine with a warm neutral text colour. |
| Decorative looping animation | Motion is limited to a short hero entrance and the workflow transition; reduced-motion disables non-essential animation. |

## 4. Visual translation

| Concern | Approach |
| --- | --- |
| Atmosphere | A soft radial wash in sage, sand and paper behind the hero. The dark theme uses green-black and muted amber glows. |
| Primary accent | Deep pine `#0C5B4A` in light; mint `#6FD3B2` in dark. |
| Surface hierarchy | Page, card, subtle surface and control surface all come from tokens. No card-inside-card stacking. |
| Typography | Neo-grotesque UI at 12–16px in the console and a display scale on the landing page. Italic serif is used only for emphasis, never for body text. |
| Numbers and hashes | Geist Mono with tabular numerals; hashes are shown in short head/tail form and can be copied. |
| Product visual | The hero preview uses real console primitives (sidebar, metrics, graph, risk dial), not a fake browser chrome with lorem ipsum. |
| Responsive behaviour | The hero stacks, the preview crops rather than overflowing, and the workflow selector remains operable. |
| Theme | Light is canonical and first; dark is a separate palette with its own contrast and chart colours. |

## 5. Copy rules

- Prefer concrete operational language: “quarantine”, “maker-checker”, “canonical JSON”, “SHA-256”, “failing item”.
- Avoid claims that cannot be supported by the repository.
- Name unsupported formats instead of hiding them. FMR is `TODO(compliance)`.
- Say “synthetic” wherever a number or record could be mistaken for live bank data.
- Keep the landing page aspirational but not deceptive: the boundaries section is part of the product surface, not fine print.

## 6. Accessibility and motion

- Every interactive target is a real `button` or `link`.
- Icon-only controls have explicit accessible names that include the visible context.
- Focus rings use the `--ring` token and remain visible on tinted surfaces.
- The workflow carousel has previous/next controls and stable dot targets; it is not an auto-playing carousel.
- `prefers-reduced-motion` removes entrance and gradient drift, leaving a static atmosphere.
- The hero visual is marked as decorative/explanatory and the surrounding copy carries the meaning; no information is conveyed by colour alone.

## 7. What a future redesign could add

- A real product-led interactive demo with a tiny synthetic case rather than a static preview.
- A dedicated evidence-integrity page with a public verification widget.
- A model card page that shows evaluation caveats, drift and threshold policy in more depth.
- A public security page that distinguishes the current demo from a production deployment.

None of those additions should require copying another company's visual identity.
