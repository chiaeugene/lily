# Reference: 21st.dev "Complex Data Table" (@felipemenezes098/table-20)

Retrieved from 21st.dev. Kept here as the design reference for the Records
table rather than pasted straight in, because it **cannot** be dropped into
this project as-is:

1. It is styled with shadcn's CSS-variable palette — `bg-popover`,
   `text-muted-foreground`, `border-input`, `bg-accent`, `text-primary-foreground`.
   Lily has none of those. Lily's tokens are `canvas`, `surface`, `ink`,
   `muted`, `faint`, `line`, `primary`, `profit`, `loss`, `warn`
   (see tailwind.config.ts). Pasting it renders an unstyled/broken table.
2. It pulls in six shadcn primitives (button, badge, checkbox, dropdown-menu,
   input, table) plus `@radix-ui/react-checkbox`,
   `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot`,
   `class-variance-authority`. Adopting all of those would introduce a second,
   competing design system alongside Lily's own.
3. Its demo `Payment` shape and USD currency formatting are placeholders — the
   real Records table renders `Transaction` objects with a 3-invoice cascade,
   RM amounts, payment state and aging.

## What we actually take from it

The *structure*, which is sound and worth copying:

- TanStack `useReactTable` with `getCoreRowModel` / `getSortedRowModel` /
  `getFilteredRowModel` / `getPaginationRowModel`
- `SortingState`, `ColumnFiltersState`, `VisibilityState`, `RowSelectionState`
  held in `useState` and passed via `state` + `onXChange`
- Sortable headers via `column.toggleSorting(column.getIsSorted() === "asc")`
- A global/column filter input bound to `column.setFilterValue()`
- A column-visibility dropdown driven by
  `table.getAllColumns().filter(c => c.getCanHide())`
- Pagination through `table.previousPage()` / `nextPage()` with
  `getCanPreviousPage()` / `getCanNextPage()`
- Empty state rendered as a single full-width row

## Plan

Build `components/records-table/RecordsTable.tsx` using TanStack directly
(already installed) with Lily's own tokens and existing `Card` / `CompanyBadge`
/ `PaymentStatusChip` components — same capabilities, no parallel design
system, no unstyled output.

Columns: Transaction ID · Customer · Date · Sales (RM) · Margin (RM) ·
Payment status (paid / unpaid / overdue Nd) · actions (View, journey, PDF).
