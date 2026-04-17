# Accessibility Test Suite — WCAG 2.1 AA Compliance (P3-09)

Complete test coverage for MeatyWiki Portal frontend screens and components.

## Test File Inventory

| Test File | Coverage | Test Count |
|-----------|----------|-----------|
| `login.a11y.test.tsx` | Login form | 10+ tests |
| `inbox.a11y.test.tsx` | Inbox screen | 12+ tests |
| `library.a11y.test.tsx` | Library screen | 12+ tests |
| `artifact-card.a11y.test.tsx` | ArtifactCard component | 14+ tests |
| `shell.a11y.test.tsx` | Shell navigation layout | 12+ tests |
| `forms.a11y.test.tsx` | Form components (generic) | 15+ tests |
| `modal.a11y.test.tsx` | Modal/Dialog semantics | 13+ tests |
| `badges.a11y.test.tsx` | Badge components | 14+ tests |
| `color-contrast.a11y.test.tsx` | Color token validation | 13+ tests |
| `README.md` | Test documentation | Reference guide |

**Total: ~120+ automated accessibility tests**

## Test Categories

### Automated Checks (jest-axe)

Every test file includes:
```typescript
import { axe, toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);

it("renders with 0 axe violations", async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

Results in ~100+ automated axe-core violation checks across all screens.

### Manual WCAG Compliance Tests

#### Keyboard Navigation (2.1.1, 2.1.2)
- `shell.a11y.test.tsx`: Tab order through navigation
- `forms.a11y.test.tsx`: Tab order through form fields
- `login.a11y.test.tsx`: Tab between input and submit button
- `modal.a11y.test.tsx`: Focus trap and tab panel navigation

#### Focus Visibility (2.4.7)
- All button/link focus ring classes verified: `focus-visible:ring-2 focus-visible:ring-ring`
- Present in: login, inbox, library, shell, modal, forms tests

#### Semantic HTML (1.3.1)
- **Headings**: Hierarchy verified in inbox, library, artifact-detail tests
- **Lists**: `role="list"` + `<li>` structure in inbox, library, shell tests
- **Form labels**: `htmlFor/id` association in login, forms tests
- **ARIA roles**: `role="article"`, `role="alert"`, `role="status"`, `role="dialog"`, `role="tabpanel"`

#### Color Contrast (1.4.3, 1.4.11)
- `color-contrast.a11y.test.tsx`: 13 dedicated tests for design tokens
- Tailwind classes verified: `text-foreground`, `text-muted-foreground`, `text-destructive`, `text-primary-foreground`
- Button colors: Primary, destructive, accent, secondary backgrounds
- Required: ≥4.5:1 normal text, ≥3:1 large text

#### Form Accessibility (3.3)
- `forms.a11y.test.tsx`: Label association, fieldsets, legends
- `login.a11y.test.tsx`: Input type, required attribute, error messaging
- Error message linking via `aria-describedby`
- Invalid input marking via `aria-invalid`

#### ARIA (4.1.2)
- `artifact-card.a11y.test.tsx`: `aria-label` on articles and links
- `inbox.a11y.test.tsx`: `aria-label`, `aria-live`, `role="alert"`, `role="status"`
- `modal.a11y.test.tsx`: `aria-modal="true"`, `aria-labelledby`, tab panel structure
- `library.a11y.test.tsx`: `aria-pressed`, `aria-busy`, `aria-label` on view toggle

#### Alternative Text (1.1.1)
- Decorative icons: `aria-hidden="true"` verified on SVGs
- Button labels provide accessible names
- Images: `alt` attribute tested via next/image mock

#### Motion & Animation (2.3.3)
- No auto-play detected in component structure
- Respects `prefers-reduced-motion` (via Tailwind utilities)

## Acceptance Criteria Status

| Criteria | Status | Evidence |
|----------|--------|----------|
| axe scan: 0 violations | ✅ PASS | 120+ automated checks |
| Manual screen reader test | 🟡 Manual | See below |
| Keyboard navigation fully functional | ✅ PASS | Tests in shell, forms, modal |
| All focus states visible and clear | ✅ PASS | focus-visible:ring verified in all tests |

## Manual Verification Checklist

These require hands-on testing with assistive technology (not automated):

- [ ] **Screen reader (VoiceOver / NVDA)**
  - [ ] Form error messages announced
  - [ ] Alert/status role messages announced
  - [ ] List structure and item count announced
  - [ ] Button states (disabled, active) announced
  - [ ] Modal focus trap and announcements

- [ ] **Keyboard-only navigation**
  - [ ] Tab moves through all controls forward and backward
  - [ ] No keyboard traps (can always move focus out)
  - [ ] Modals can be closed with Escape key
  - [ ] Loading skeletons don't trap focus

- [ ] **Color contrast (visual verification)**
  - [ ] Primary button text readable on background
  - [ ] Muted text still readable (not too faint)
  - [ ] Error text (red) clearly visible
  - [ ] Focus ring visible on all backgrounds

- [ ] **Zoom and text scaling**
  - [ ] 200% zoom doesn't break layout (P3-10)
  - [ ] Text reflow on narrow viewports (P3-10)

## Running Tests

```bash
# Install dependencies first
pnpm install

# Run all a11y tests
pnpm test tests/a11y

# Run specific test file
pnpm test tests/a11y/login.a11y.test.tsx

# Watch mode for development
pnpm test:watch tests/a11y

# Coverage report
pnpm test:coverage tests/a11y
```

## Test Execution in CI

Tests run automatically on PR via GitHub Actions:

```yaml
- name: Run accessibility tests
  run: pnpm test:a11y --coverage
```

Failure of any test blocks PR merge.

## Design Token Reference

Color contrast verified against design tokens from `src/app/globals.css`:

| Token | Usage | Contrast |
|-------|-------|----------|
| `--foreground` | Primary text | 4.5:1+ on background |
| `--muted-foreground` | Secondary text | 4.5:1+ on background |
| `--destructive` | Error text | 4.5:1+ on background |
| `--primary-foreground` | Primary button text | 4.5:1+ on primary bg |
| `--accent-foreground` | Secondary button text | 4.5:1+ on accent bg |

All verified in `color-contrast.a11y.test.tsx`.

## Deferred Accessibility Work (v1.5+)

Out of scope for P3-09 but tracked for future phases:

- **P3-10**: Touch targets ≥ 44px, mobile viewport testing, Lighthouse score
- **v1.5**: PWA accessibility (service worker offline mode)
- **v1.5**: Advanced screen reader testing (ARIA menu patterns, custom widgets)
- **v1.5**: Internationalization (text direction, language tags)

## References

- WCAG 2.1 Level AA: https://www.w3.org/WAI/WCAG21/quickref/
- jest-axe docs: https://github.com/nickcolley/jest-axe
- axe DevTools: https://www.deque.com/axe/devtools/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

## Test Maintenance

When adding new screens or components:

1. Copy a relevant test file template (e.g., `library.a11y.test.tsx` for new list screen)
2. Replace component imports and test IDs
3. Add tests for new ARIA roles or interactive patterns
4. Run `pnpm test:a11y` to verify 0 violations
5. Commit as part of the feature PR

---

**Last Updated**: P3-09 (Phase 3 Batch 3)  
**Status**: Complete — Ready for manual verification
