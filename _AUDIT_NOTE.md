# Audit Note — AIProposalSOWGenerator

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_07.md` section #4.

## Original Recommendations
TSV said `0 routes / 0 AI endpoints` / "Skeleton". **This is wrong on inspection** — `backend/server.js` is ~1765 lines with at least 9 AI endpoints already implemented:

- `/api/ai/generate`
- `/api/ai/generate-proposal`
- `/api/ai/generate-sow`
- `/api/ai/improve-text`
- `/api/ai/suggest-pricing`
- `/api/ai/analyze-win-loss`
- `/api/ai/differentiate-competitor`
- `/api/ai/generate-timeline`
- `/api/ai/generate-risk-section`

The audit miscounted because the project uses single-file Express (`server.js`) instead of `routes/*.js`.

### Custom Feature Suggestions
1. Multi-section SOW generation — already covered
2. Proposal template library — needs templates infra
3. Pricing intelligence — already covered (`/suggest-pricing`)
4. Risk allocation — already covered (`/generate-risk-section`)
5. Contract clause recommender
6. Post-signature tracking

## Implemented (Mechanical)
- None. The recommended endpoints already exist. Adding more without refactoring the 1765-line `server.js` introduces maintenance burden disproportionate to a 3-rec scope.

## Backlog (deferred)

### NEEDS-PRODUCT-DECISION (architecture)
- Refactor `backend/server.js` into `routes/` modules (deferred — beyond mechanical 3-rec scope, breaks paths if mishandled).
- Templates infrastructure (proposal/SOW templates by industry).
- Contract clause recommender — needs clause library.
- Post-signature tracking workflow.

### NEEDS-CREDS / NEW-DEPS
- DocuSign / Adobe Sign integration.
- Pricing benchmark data sources.

### TOO-RISKY
- Auto-issuance of legally binding documents (must remain advisory).

## Audit Re-categorization
The verdict should be **"substantive (single-file)"** rather than "skeleton".

## Apply pass 3 (frontend)

- Action: **LEFT-AS-IS**.
- FE (single-file `frontend/src/App.js` SPA) already calls every backend AI endpoint:
  - `/api/ai/generate`, `/generate-proposal`, `/generate-sow`, `/suggest-pricing`, `/analyze-win-loss`, `/differentiate-competitor`, `/generate-timeline`, `/generate-risk-section`.
  - Resource-scoped: `/api/proposals/:id/ai-refine-scope`, `/ai-price-check`, `/generate-contract`.
- JWT Bearer auth set on axios after login (token persisted in `localStorage`).
- Minor gap (deferred, out of scope): backend `/api/ai/improve-text` has no dedicated FE caller. Not added — no obvious UX slot, and "minimal page" rule + idempotence keep us hands-off here.
- 503-no-key handling: server returns 503 with `error` field; FE shows axios error.
- Idempotent — no FE files touched.

## Apply pass 3 (Group A)

**Action:** UPDATED-FE — wired `/api/ai/improve-text`.

Slot: the natural place is the existing AI Generator page (`AIGenerator` component in `frontend/src/App.js`, ~line 2515). After generating proposal/SOW content via `/ai/generate*`, a user typically wants to refine tone or shorten — `improve-text` with its 5 styles (professional / concise / persuasive / technical / friendly) maps onto exactly that. Added an "Improve Text" panel directly under the existing output area + actions.

**Files modified:**
- `frontend/src/App.js`
  - Inside `AIGenerator` component: added `improveStyle`, `improving`, `improveError`, `pasteText`, `showPaste` state and an `improveText(sourceText)` async handler that POSTs to `${API_URL}/ai/improve-text`. On success, the result replaces the output area so the existing Copy/Clear actions apply transparently.
  - Rendered an `.ai-improve` panel under the existing output controls: style `<select>`, "Improve Output" primary button (disabled if no output), and a toggle to expose a textarea for pasting external text. Uses existing `Sparkles`, `Wand2`, `Edit` icons (already imported).
  - 503-no-key handling: backend's `callOpenRouter` throws when `OPENROUTER_API_KEY` is unset; the FE matches on `/api key/i` (or HTTP 503) and surfaces "AI not configured (503). Set OPENROUTER_API_KEY in backend .env." inline.

**Syntax check:** `@babel/parser` (jsx plugin) PASS.

**Notes:** No new dependencies. Uses existing `axios`, `API_URL`, `useState`, lucide icons. Pattern matches the other AI features that mutate `output` and rely on the existing Copy/Clear buttons.

## Apply pass 4 (mechanical backlog)

- **Action:** LEFT-AS-IS (no MECHANICAL items remain)
- **Features added:** none
- **Backlog deferred:** Refactor 1765-line `server.js` into routes/* (NEEDS-PRODUCT-DECISION — architectural), template infrastructure for proposals/SOWs (NEEDS-PRODUCT-DECISION — needs library + governance), contract clause recommender (NEEDS-PRODUCT-DECISION — needs clause library), post-signature tracking workflow (NEEDS-PRODUCT-DECISION), DocuSign / Adobe Sign (NEEDS-CREDS), pricing benchmark data sources (NEEDS-CREDS), auto-issuance of legally binding documents (TOO-RISKY).
- **Smoke test:** N/A (no code change)
- **Notes:** All 9 audit-recommended AI endpoints already exist. Pass-3 wired `/api/ai/improve-text`. Remaining items either need product/architecture decisions, third-party creds, or carry legal-risk constraints — outside mechanical scope.
