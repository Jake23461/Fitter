# Hooks Catalogue

Custom React hooks in `src/hooks/`. Add entries here as hooks are created.

---

## Convention

- Hooks that fetch data wrap `useQuery` from TanStack React Query
- Hooks that mutate data wrap `useMutation` and call `queryClient.invalidateQueries` on success
- Query key conventions are in `supabase-patterns.md`

---

## Hooks

*(None yet — add entries below as hooks are built)*

---

### Template

```
### `useXxx(param)`
**File:** `src/hooks/useXxx.ts`
**Returns:** `{ data, isLoading, error, ... }`
**Description:** What it does in one sentence.
```
