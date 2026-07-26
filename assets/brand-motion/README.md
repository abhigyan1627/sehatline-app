# SehatLine oxygen-tree motion

A decorative, reusable background identity for the patient and doctor apps. The canopy combines a tree, healthy lungs, oxygen bubbles, and a single care pulse. It uses the existing SehatLine green–cyan–blue palette.

## Basic integration

Link the stylesheet (adjust the relative path from the target app):

```html
<link rel="stylesheet" href="../assets/brand-motion/brand-motion.css">
```

Add the two classes to the page and insert one decorative layer near the start of `body`:

```html
<body class="sl-brand-surface">
  <div class="sl-oxygen-bg" aria-hidden="true"></div>
  <main>
    <!-- app content -->
  </main>
</body>
```

The CSS file resolves `oxygen-tree.svg` relative to itself, so the pair can also be copied together into an app bundle.

## Variants

- Default: `.sl-oxygen-bg` — right-aligned onboarding / home background.
- Centered: `.sl-oxygen-bg.sl-oxygen-bg--center` — splash and sign-in screens.
- Quiet: `.sl-oxygen-bg.sl-oxygen-bg--quiet` — data-heavy doctor and admin screens.
- Compact: `.sl-oxygen-bg.sl-oxygen-bg--compact` — empty states and small cards.

Use `--sl-motion-opacity` and `--sl-motion-size` on a page or component for local tuning:

```css
.patient-welcome {
  --sl-motion-opacity: 0.76;
  --sl-motion-size: min(920px, 88vmin);
}
```

Keep buttons, text, and form fields outside `.sl-oxygen-bg`; it is intentionally non-interactive and hidden from accessibility APIs.

## Motion and accessibility

- The scene animates only `transform`, `opacity`, and one lightweight SVG stroke offset.
- Both the SVG and wrapper honor `prefers-reduced-motion: reduce`.
- Forced-colors mode removes the decorative layer.
- The background carries no information required to use the app.

Open `preview.html` to review the default desktop/mobile composition.
