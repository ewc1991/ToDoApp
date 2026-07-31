# Design style — "sticker sheet"

A portable description of the visual language used in GooliList, written so it can be applied to a different app with a different palette. **Colour values are deliberately omitted.** What follows is the construction, not the paint.

The short version: **flat fills inside heavy outlines, with hard unblurred shadows, so every surface reads as a die-cut sticker laid on a sheet.**

---

## 1. The core construction

Every raised surface — cards, buttons, inputs, sheets, chips — is built the same way:

- **A flat fill.** No gradients, ever. No translucency except where something floats over a map or photo.
- **A heavy outline**, uniform width, in the ink colour. Not a hairline, not a tint of the fill. 2px at phone scale. This is the single most defining choice; a 1px grey border produces a completely different (and generic) result.
- **A generous corner radius** — roughly 20px for cards, 12px for smaller controls, fully rounded for pills.
- **A hard offset shadow**: `box-shadow: 3px 3px 0 <ink>`. **Zero blur.** The shadow is the same colour as the outline, not black, not a soft grey. Smaller elements use a 2px offset.

```css
.card {
  background: var(--surface);
  border: 2px solid var(--ink);
  border-radius: 20px;
  box-shadow: 3px 3px 0 var(--ink);
}
```

If you take one thing: **blur radius is always 0.** A blurred shadow instantly turns this into ordinary material design.

## 2. Press behaviour

Pressing displaces the element by exactly the shadow offset and removes the shadow, so it looks physically pushed down onto the page:

```css
.card:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--ink);
}
```

Buttons collapse the shadow entirely (`box-shadow: none`). This is the primary interaction feedback in the whole system — there are no hover states worth speaking of, because it is a touch-first design.

## 3. Colour roles, not colour values

Pick your own palette, but assign these five roles. The system depends on the *relationships*, not the hues.

| Role | What it does |
|---|---|
| **Ground** | The page. Saturated enough to be a choice, not a neutral. Everything sits on it. |
| **Surface** | Cards, sheets, inputs. Distinct from ground but in the same family — a lighter, softer sibling, not white. |
| **Ink** | Every outline and every piece of text. One colour doing both jobs is what unifies the look. Very dark, but not black. |
| **Accent** | Interactive things: primary buttons, links, active states. One accent only. |
| **Support** | One or two extra hues for meaning — a "done" colour, a "favourite" colour. Used sparingly and never for chrome. |

Two rules that matter more than the hues:

- **Derive your palette from something real** — a logo, an illustration, a photograph the product is about. Sampling actual pixel values from an existing asset makes the app and its icon read as one object, and it forces choices you wouldn't have made from a colour picker.
- **Keep a darkened variant of the accent for text.** A mid-tone accent that looks right as a button fill will usually fail contrast behind white text. Have `--accent` for fills and borders and `--accent-ink` for text — same hue, darker. Nobody perceives them as different colours; the contrast checker does.

## 4. Type

**Two faces, clearly different jobs.**

- **Display face** — used for the wordmark, headings, and *names of things* (a place name, a card title). Choose something with personality that echoes the app's illustration style. In GooliList that meant rounded and slightly chunky, matching thick outlines.
- **Body face** — everything else. Humanist, highly legible at 15–16px on a phone. It should recede.

The discipline is in the split: **the display face labels nouns the user cares about; the body face carries everything the system says.** Don't use the display face for button labels or paragraphs.

**Self-host the fonts.** Do not link a font CDN. A webfont request is exactly what fails on a bad connection, and offline it never arrives. Both faces here are variable fonts, and the provider served an identical file for every requested weight — check for this, it halved the payload.

## 5. Chips and pills

The workhorse control. Pill-shaped, outlined, transparent fill by default. Selected state **inverts**: fill with ink, text becomes ground.

```css
.chip { border: 2px solid var(--ink); border-radius: 999px; background: transparent; }
.chip[aria-pressed='true'] { background: var(--ink); color: var(--ground); }
```

Variants by border style rather than by colour where possible — dashed for "add this" or "optional", solid for real state. It keeps the palette small.

## 6. Iconography

**Inline SVG, never emoji.** Emoji render differently on every platform, arrive in full colour you didn't choose, and fight a flat outlined style.

Draw them as strokes on a 16×16 viewBox, `stroke="currentColor"`, `stroke-width` around 1.6, round caps and joins. They then inherit text colour automatically and sit at the same visual weight as the outlines around them.

## 7. Sheets and overlays

Modals slide up from the bottom, not from the centre — thumbs are at the bottom.

A sheet is a **flex column with a pinned head and one scrolling region**:

- The handle, title, and any search field live in a non-scrolling head.
- Exactly one child scrolls — usually a results list.
- Actions pin to the bottom.

Two properties are load-bearing and easy to forget:

- `min-height: 0` on the scrolling child. Without it a flex item refuses to shrink below its content and the whole sheet overflows instead of scrolling.
- `overscroll-behavior: contain` on that child, so reaching the end doesn't chain the scroll into the page behind.

Lock the page behind an open sheet. On iOS, `overflow: hidden` on `body` is **not enough** — pin the body with `position: fixed` at a negative scroll offset, lock `<html>` too, and restore the scroll position on close.

## 8. Layout

- **Single column.** One card per row. Resist grids on phone-first apps; they halve the readable name length for no gain.
- **Bottom bar for constant actions** — mode switching plus the primary create action, always reachable. Fixed.
- **The header scrolls away.** A sticky header eats ~110px of a phone screen permanently. Put persistent things in the bottom bar instead, and offer a scroll-to-top button once the user is more than half a viewport down.
- **Full-bleed for immersive views.** A map or gallery should fill the screen edge to edge with controls floating over it on a translucent, blurred ground — not sit inside a padded card.

## 9. Motion

Sparing and short. 0.12–0.18s, ease-out. Sheets slide a small distance rather than a full screen height. Press feedback is instant, not animated.

One place to spend motion: **the app's signature moment** (see below). Everything else should feel immediate rather than animated.

Respect `prefers-reduced-motion` globally, and check what the reduced state actually looks like — collapsing an animation to its 0% keyframe can leave something invisible or mid-fade. Give it an explicit resting appearance.

## 10. The signature element

Choose **one** memorable ornament and tie it to the app's core purpose — not to decoration.

In GooliList, places graduate from "want to go" to "been", and that is the whole point of the list, so marking something as been drops a rotated, passport-style **stamp** on the card carrying the rating. It makes the one interaction the app exists for feel like something happened.

The test: **if you removed this, would the app still be recognisable?** If yes, it isn't the signature. Pick the moment that matters, not the prettiest surface.

## 11. Copy

- **Title Case for titles and buttons, including prepositions** — "Want To Go", "Add It By Hand", "Back To Search".
- **Sentence case for placeholders and explanatory text.** These are instructions, not labels.
- **Active voice on buttons**, and **the same verb through an entire flow**: a button reading "Mark As Been" produces a confirmation reading "Marked as been." Never "Mark as visited" → "Saved!".
- **Name things by what the user controls**, not how the system works.
- **Empty states invite an action** and never apologise. Put the illustration there, one line of what to do, one button.

## 12. Quality floor

Non-negotiable, and most of these are invisible until they bite:

- **All text inputs at 16px minimum.** Below that, iOS zooms the page on focus and does not zoom back out. Accept the slightly chunkier field.
- **44px touch targets** regardless of how small the glyph looks. Small ✕ and × buttons need padding, not a smaller font.
- **Visible focus rings** on everything, via `:focus-visible`, with an offset.
- **Safe-area insets.** If you set `viewport-fit=cover` for the notch, you must inset the content back with `env(safe-area-inset-*)` or the header runs under the status bar.
- **Handle the on-screen keyboard.** iOS shrinks the *visual* viewport but not the *layout* viewport, then scrolls, dragging `position: fixed` elements out of place. Track `window.visualViewport`, publish its height and offset as CSS variables, and position overlays against those. Hide the bottom bar while the keyboard is open — it's unreachable and in the way.
- **Contrast: measure it, don't judge it by eye.** Write a script that reads the token values out of your stylesheet and computes the ratios, so it can't drift from what you're actually shipping.

## 13. Anti-patterns

Things that will quietly turn this into a generic app:

- Blurred or black shadows.
- 1px grey borders.
- Gradients on surfaces.
- Emoji as interface icons.
- A neutral grey or white page ground.
- Using the display face for body copy.
- More than one accent colour.
- Hover states carrying meaning that touch users never see.

---

## Applying this to a new app

1. **Find the source asset** — icon, illustration, product photo — and sample real colours from it. Assign them to the five roles.
2. **Pick two faces** whose forms echo that asset. If the artwork has thick rounded strokes, the display face should too.
3. **Build the four primitives first**: card, chip, button, sheet. Get the outline weight, radius and shadow offset consistent across all four before building any screens.
4. **Decide the signature moment** before designing screens, so the layout can make room for it.
5. **Set the quality floor early** — 16px inputs, focus rings, safe areas, reduced motion. Retrofitting these is much worse than starting with them.
