---
name: childled-ui
description: Use when creating or modifying ChildLed frontend UI; follow its established visual language and component patterns rather than applying a generic SaaS redesign.
---

# ChildLed UI

- Before editing, inspect the rendered page, adjacent screens, and the component being changed. Use `artifacts/childled/src/index.css`, `src/theme/design-tokens.css`, relevant `src/components/` or `src/pages/`, and the existing `Button`, `SectionHeading`, `Modal`, and `EmptyState` patterns in `src/App.tsx` as references. Check Git history when the request is to restore an earlier look.
- Preserve ChildLed's warm, child-centered identity: forest/sage/gold/cream semantic tokens; Fraunces display headings, DM Sans body text, Space Mono micro-labels; soft shadows, rounded controls, clear iconography, and selective warm highlights. Existing cards and subtle gradients are deliberate patterns, not defects to remove by default.
- Match the density and tone of the surrounding workflow. Keep clinical tools easy to scan and repeat, while allowing the more expressive treatment already used in family, classroom, and overview areas. Extend existing React, Tailwind, design-token, and Lucide patterns before inventing new ones.
- Improve hierarchy, spacing, mobile wrapping, touch targets, keyboard/focus behavior, labels, and contrast without flattening the brand or redesigning unrelated sections. Avoid introducing decorative effects, colors, cards, or badges that do not serve the specific screen.
- Preserve routes, data flow, permissions, and working controls during visual changes. Compare before/after desktop and mobile views, including loading, empty, error, and populated states where relevant.
