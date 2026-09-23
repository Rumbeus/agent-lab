# Repair duplicate notification delivery

Fix `src/inbox.mjs` while preserving its exported interface:
`createInbox(deliver)` returns an async `handle(event)` function.

Each event has nonempty string `tenantId` and `id` fields and arbitrary `payload`.
Inputs are valid. The same event may arrive repeatedly, including concurrently.

Required behavior within one inbox instance:

- First successful delivery calls `await deliver(event)` and resolves to
  `{ status: 'delivered' }`.
- Later deliveries with the same tenantId/id resolve to `{ status: 'duplicate' }`
  without calling deliver again, even if the payload changed.
- Concurrent duplicates wait for the original delivery. If it succeeds, exactly
  one caller receives 'delivered'; the other callers receive 'duplicate'.
- If delivery rejects, all callers waiting on that attempt reject. The event is
  eligible for a later retry. Do not swallow the delivery error.
- Different tenants and different event IDs are independent. Delimiters inside
  either string must not cause identity collisions.
- State belongs to the inbox instance. Do not mutate the input events.

Use only the standard library. The starter smoke test is runnable with
`node --test smoke.test.mjs`. Add your own focused tests if useful. Only the
implementation module is graded; keep it self-contained. Work in this directory.
