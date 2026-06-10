---
name: frontend-design
description: Design tokens, spacing, typography, and component conventions for this project. Read before building or modifying any UI component.
---

# Frontend Design Skill

## Design tokens
- **Primary color**: defined in `tailwind.config.ts` as `primary`. Use `bg-primary`, `text-primary-foreground`.
- **Spacing**: stick to Tailwind's default scale (4, 6, 8, 12, 16). Avoid arbitrary values like `p-[13px]`.
- **Radii**: `rounded-lg` for cards, `rounded-md` for inputs and buttons, `rounded-full` for avatars.
- **Shadows**: `shadow-sm` default, `shadow-md` on hover for interactive cards.

## Typography
- Headings use `font-semibold`, body uses default weight.
- Page title: `text-3xl font-semibold tracking-tight`
- Section title: `text-xl font-semibold`
- Body: `text-base text-foreground`
- Muted: `text-sm text-muted-foreground`

## Component conventions
- Prefer shadcn/ui (`Button`, `Card`, `Input`, `Dialog`) over custom.
- Every interactive element must have a visible focus state — do not strip default outlines without replacing them.
- Forms: label every input. Error messages go below the input in `text-sm text-destructive`.

## Layout
- Page max width: `max-w-6xl mx-auto px-4 sm:px-6`.
- Mobile first: write the mobile layout first, add `sm:` and `md:` for larger screens.
- Use CSS Grid for 2D layouts, Flexbox for 1D.

## What to avoid
- Inline styles (`style={{...}}`) — use Tailwind.
- Magic numbers in classes (`h-[437px]`) — pick the closest scale value.
- Nested ternaries in JSX — extract to a variable above the return.
