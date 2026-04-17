# Accessibility Tests (P3-09)

WCAG 2.1 AA compliance tests for the MeatyWiki Portal frontend.

## Overview

These tests verify accessibility compliance across all authenticated screens (Inbox, Library, Artifact Detail, Workflows) and the login screen using automated axe-core scans and manual ARIA/semantic validation.

## Test Files

| File | Scope | Coverage |
|------|-------|----------|
| `login.a11y.test.tsx` | Login form | Form labels, keyboard nav, error states |
| `inbox.a11y.test.tsx` | Inbox screen | Heading hierarchy, list semantics, buttons |
| `library.a11y.test.tsx` | Library screen | View toggle, filter bar, grid/list |
| `artifact-card.a11y.test.tsx` | ArtifactCard component | Article role, stretch link, time element |
| `shell.a11y.test.tsx` | Shell navigation | Landmarks, focus management, nav structure |
| `forms.a11y.test.tsx` | Form components | Label association, fieldsets, input validation |

## Running Tests

```bash
# Run all a11y tests
pnpm test tests/a11y

# Run specific test file
pnpm test tests/a11y/login.a11y.test.tsx

# Run with coverage
pnpm test:coverage tests/a11y

# Watch mode
pnpm test:watch tests/a11y
```

## WCAG 2.1 AA Coverage

### Color Contrast (1.4.3, 1.4.11)
- Normal text: ≥ 4.5:1 ratio (verified via design tokens in globals.css)
- Large text: ≥ 3:1 ratio
- Implementation: Tailwind classes (`text-foreground`, `text-muted-foreground`) reference CSS variables with tested contrast

### Keyboard Navigation (2.1.1, 2.1.2)
- All interactive elements reachable via Tab
- No keyboard traps
- Focus order logical and visible
- Tests: Verify `tabIndex`, `focus-visible:ring`, focus management in focus trees

### Focus Visible (2.4.7)
- All buttons/links have visible focus indicator
- Classes: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`
- Verified in: login, inbox, library, shell tests

### Semantic HTML (1.3.1, 2.4.1)
- Proper heading hierarchy (h1 > h2/h3, no skipped levels)
- List semantics (`<ul>`, `<li>`, `role="list"`)
- Landmark roles (`<main>`, `<aside>`, `<nav>`)
- Article elements for card components
- Tests: Role-based queries in all test files

### Form Labels (1.3.1, 2.5.3)
- Input labels associated via `htmlFor/id`
- Error messages linked via `aria-describedby`
- Invalid inputs marked with `aria-invalid`
- Fieldsets + legends for radio/checkbox groups
- Tests: login.a11y.test.tsx, forms.a11y.test.tsx

### ARIA Attributes (1.3.1, 4.1.2)
- `role="article"` on artifact cards
- `role="alert"` on error banners
- `role="status"` on empty states
- `aria-label` on buttons (Quick Add, Load more)
- `aria-pressed` on view toggle buttons
- `aria-describedby` on form inputs with help text
- `aria-live="polite"` on dynamic content
- `aria-hidden="true"` on decorative icons

### Alternative Text (1.1.1)
- Decorative SVGs marked `aria-hidden="true"`
- Images use `alt` attribute (next/image mock in tests)
- Text alternatives for icons provided via button labels

### Motion & Animation (2.3.3)
- No auto-play video/animation
- Respects `prefers-reduced-motion` (Tailwind utilities in use)
- Tests: Verify absence of autoplay attributes, animation classes

### Heading Hierarchy (2.4.10)
- Page h1 per screen (Inbox, Library, etc.)
- Card titles use h3 (inside article)
- No skipped heading levels
- Tests: `screen.getByRole("heading", { level })` assertions

### List Structure (1.3.1)
- Navigation items in `<ul>`/`<li>` or `role="list"`/`role="listitem"`
- Artifact lists use semantic list structure
- Tests: Verify role="list" and li children

## axe-core Integration

All tests extend `toHaveNoViolations()` from jest-axe. Each test file includes:

```typescript
import { axe, toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);
```

Automated violations caught:
- Missing labels on form inputs
- Missing landmark roles
- Invalid heading hierarchy
- Color contrast failures (when computed)
- Missing alt text
- Invalid ARIA attributes

## Manual Testing

The following items require manual verification (not automated by jest-axe):

1. **Screen reader announcements**
   - VoiceOver (Mac) or NVDA (Windows)
   - Verify form error messages announced
   - Verify status/alert roles trigger announcements

2. **Color contrast (visual)**
   - Primary button vs. background
   - Muted text vs. background
   - Error text (destructive token) vs. white background
   - Design tokens verified in: `src/app/globals.css` (CSS variables)

3. **Keyboard-only navigation**
   - No focus traps (Tab can always move forward and backward)
   - Modal/dialog focuses correctly
   - Can close modals with Escape key

4. **Zoom and responsive text**
   - 200% zoom doesn't break layout
   - Touch targets ≥ 44px (P3-10)
   - Text reflow on narrow viewports (P3-10)

## Color Contrast Verification

Tailwind v4 design tokens (from shadcn/ui slate base):

```css
/* From globals.css */
--foreground: 0 0% 3.6%;           /* 98.4% white bg → 4.5:1+ */
--muted-foreground: 0 0% 45.1%;    /* 40%+ lightness → 4.5:1 on white */
--destructive: 0 84% 60%;          /* Red token tested */
```

All text colors from the Tailwind palette meet or exceed 4.5:1 on their intended backgrounds.

## Playwright e2e Accessibility

See also: `e2e/accessibility.spec.ts` (if present)

E2E tests use `@axe-core/playwright` for page-level scans:

```bash
pnpm e2e
```

## Deferred Items (v1.5+)

The following are out of scope for P3-09 (handled in mobile/performance phases):

- Touch target size validation (44px minimum) — P3-10
- Mobile viewport testing (320px, 375px) — P3-10
- Lighthouse accessibility score ≥ 90 — P3-10
- Performance (LCP, CLS) — P3-10
- PWA accessibility (service worker, offline) — deferred to v1.5

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [MDN ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Tailwind CSS Accessibility](https://tailwindcss.com/docs/installation#accessibility)
