# Reassignment Engine Spec (Smart Suggestions + Apply)

## Goal
Enable the system to suggest and apply safe vehicle reassignments when a requested car is unavailable, while maximizing booking fulfillment, minimizing customer disruption, and preserving operator speed.

The engine must be:
- **Fast** enough for live phone calls.
- **Explainable** so agents trust it.
- **Deterministic** enough to debug and audit.
- **Safe** enough for production.
- **Generic** so future fleet/business models can be added without rewriting the core.

---

## Business Problem
A customer wants a specific car or class for a date range.
That car may already be booked.
The system should:
1. Find direct alternatives.
2. If none exist, explore whether an already scheduled booking can be reassigned to another suitable car.
3. Suggest the best move chain.
4. Allow the operator to apply the reassignment.
5. Create audit events and send immediate manager alert on every apply.

---

## Product Principle
**Never auto-reassign silently.**
The engine may recommend and the operator may apply, but the system must always:
- show why the recommendation is valid,
- show who is affected,
- show the business tradeoff,
- record the decision.

---

## Roles and Permissions

### Agent
Can:
- search suggestions,
- view rationale,
- apply reassignment **within scope**,
- trigger manager alert automatically.

Cannot:
- bypass hard constraints,
- suppress alerts,
- change permission policies,
- perform hidden or silent bulk reallocations.

### Admin
Can:
- do everything agents can,
- override policies where allowed,
- access analytics and audit history,
- tune scoring and business rules.

---

## Hard Constraints (Never Violated)
1. No overlapping active bookings on the same car.
2. No assignment to inactive/unavailable car.
3. No assignment to car under maintenance / blocked state.
4. No reassignment that breaks explicit mandatory constraints:
   - customer-required car class,
   - minimum seats,
   - fuel/EV requirement,
   - accessibility requirement,
   - branch/location restriction.
5. No mutation outside caller scope (agent can only affect scope-allowed bookings).
6. No apply without audit event.
7. No apply without manager alert.

---

## Soft Constraints (Optimization Goals)
The engine should optimize for:
1. **Fulfill the new requested booking**.
2. **Minimize customer disruption** to existing bookings.
3. **Prefer equal or better replacement** over downgrade.
4. **Minimize total price loss**.
5. **Minimize number of booking moves**.
6. **Minimize operational complexity** (cleaning, branch distance, pickup mismatch).
7. **Preserve VIP / priority customers**.

---

## Engine Output Types
The engine returns ranked suggestions:

### Type A – Direct Match
Requested car/class is available directly.

### Type B – Similar Alternative
Requested car unavailable, but an equivalent or better car is free.

### Type C – One-Step Reassignment
A currently booked customer can be moved safely to another car, freeing the requested car.

### Type D – Multi-Step Reassignment
Rare and advanced: a short swap chain (max 2 or 3 moves) can satisfy the request.

For MVP, implement **A + B + C** first.

---

## Core Data Inputs
The engine should score using these data points:

### Booking attributes
- booking id
- customer name
- requested date range
- current car
- duration
- total revenue
- status
- creator/owner
- priority flag / VIP flag (future)
- hard requirements (future structured fields)

### Car attributes
- car id
- model / class / group
- price per day
- branch
- capacity / transmission / fuel / EV / luggage (future)
- active flag
- maintenance / blocked status (future)

### Operational context
- now / current time
- branch of request
- lead time until pickup
- same-day / short-notice penalty
- occupancy pressure by class and date window

---

## Scoring Model
Each candidate move gets a score.
Higher score = better recommendation.

### Base formula
`Final Score = Availability Score + Compatibility Score + Revenue Score - Disruption Penalty - Complexity Penalty - Risk Penalty`

### 1. Availability Score
How strongly the move solves the target request.
- direct free requested car: very high
- direct same-class alternative: high
- reassignment that frees target car: high
- partial fit: low

### 2. Compatibility Score
How close the replacement is to the affected booking.
- same model/class: highest
- same class but different model: high
- upgrade: positive
- downgrade: negative or blocked depending on policy

### 3. Revenue Score
Prefer options that preserve or improve expected revenue.
Examples:
- premium car used to satisfy higher-value booking: positive
- expensive replacement for low-margin booking: smaller positive / neutral
- revenue leakage: negative

### 4. Disruption Penalty
Penalty for customer impact.
Examples:
- booking starts soon: high penalty
- VIP customer: very high penalty
- already-confirmed long booking: high penalty
- short low-priority booking moved to upgrade: low penalty

### 5. Complexity Penalty
Operational cost of the move.
Examples:
- different branch: penalty
- same-day car turnaround: penalty
- requires more than one move: additional penalty

### 6. Risk Penalty
Penalty for uncertainty.
Examples:
- car near maintenance threshold
- replacement is borderline fit
- chain dependency on another booking

---

## MVP Heuristic Algorithm

### Step 1 – Normalize Request
Input:
- target requested car or class
- requested start/end dates
- business constraints
- actor role and scope

### Step 2 – Find Direct Availability
Search all cars satisfying hard constraints that are free in date range.
If exact car available -> return top result immediately.
Else score all free alternatives.

### Step 3 – If No Good Direct Match, Build Reassignment Candidates
For the requested car (or best-matching blocked cars):
1. find overlapping bookings,
2. for each overlapping booking, search a valid replacement car,
3. reject if replacement violates any hard rule,
4. score the move.

### Step 4 – Rank Candidates
Return top N suggestions with rationale fields:
- `type`
- `score`
- `why`
- `affected_booking_id`
- `replacement_car_id`
- `price_delta`
- `risk_level`
- `operator_summary`

### Step 5 – Apply Explicitly
When the operator clicks apply:
- revalidate all constraints transactionally,
- update bookings,
- write audit events,
- send manager alert,
- return result summary.

---

## Multi-Step Reassignment (Phase 2+)
If no one-step solution exists, the engine may try a bounded search.

### Search rules
- max chain length: 2 in initial advanced phase
- no cycles
- prune low-score branches early
- stop when score falls below threshold

This should be implemented only after the one-step engine is stable and trusted.

---

## Explainability Requirements
Every recommendation must expose:
- why it was selected,
- who is affected,
- what changes,
- if it is an upgrade/downgrade,
- estimated operational impact,
- confidence/risk label.

### Example UI copy
- "אפשר לשבץ את לקוח א' לרכב Hyundai Tucson ולפנות את Toyota Corolla ללקוח החדש."
- "החלופה היא שדרוג ללא תוספת מחיר ללקוח הקיים."
- "רמת סיכון: נמוכה. אין חפיפות נוספות."

---

## Reliability and Transaction Safety
This feature is high-risk; apply must be strongly consistent.

### Apply flow must:
1. open DB transaction,
2. reload affected bookings/cars,
3. lock the relevant rows (phase 2+ if needed),
4. recheck overlaps,
5. perform mutation,
6. commit,
7. write audit records,
8. enqueue/send manager alert.

### If any revalidation fails:
- abort apply,
- return structured conflict response,
- do not partially move any booking.

---

## Alerting Rules
Every successful reassignment apply must trigger:
- immediate manager/security email,
- audit log with before/after payload,
- severity at least `warning`.

### Alert payload must include
- actor email + role
- target booking id
- affected booking ids
- original car(s)
- new car(s)
- date range
- reason / engine summary
- score / risk label

---

## Audit Requirements
Audit each apply with:
- actor
- timestamp
- entity type: `booking_reassignment`
- affected booking ids
- before snapshot
- after snapshot
- rationale summary
- score + risk

---

## API Contract Proposal

### `POST /api/bookings/suggestions/search`
Input:
- requested car id or class
- date range
- constraints
- optional branch

Output:
- ranked suggestions list

### `POST /api/bookings/suggestions/apply`
Input:
- suggestion id or full suggestion payload
- operator note

Output:
- applied result
- impacted bookings
- audit id(s)
- alert status

---

## Generic Design Requirement
The engine must not hardcode only `car rental` semantics into one large function.
Instead, design these separable components:

1. **Constraint Evaluator**
   - validates hard rules
2. **Candidate Generator**
   - generates direct/reassignment candidates
3. **Scoring Engine**
   - computes score from weighted rules
4. **Explainer**
   - generates operator-facing rationale
5. **Apply Service**
   - revalidates + mutates transactionally

This keeps the system extensible for:
- branches,
- maintenance blocks,
- pricing policies,
- customer priority tiers,
- other asset types in the future.

---

## Suggested Weights (Initial Draft)
These are tunable, not final:
- direct exact match: `+100`
- same-class free alternative: `+70`
- upgrade for affected customer: `+30`
- downgrade: `-80`
- short booking moved to better car: `+20`
- affected booking starts within 24h: `-90`
- affected booking starts within 72h: `-40`
- branch mismatch: `-30`
- each extra move in chain: `-25`
- VIP affected: `-120`

---

## Rollout Plan

### Phase 4A – Suggest Only
- direct alternatives
- one-step reassignment recommendations
- no apply yet

### Phase 4B – Apply with manager alert
- allow agent/admin apply
- mandatory audit + email alert
- strict one-step only

### Phase 4C – Advanced Optimization
- bounded multi-step chains
- confidence thresholds
- row-locking improvements
- richer constraints and pricing logic

---

## Acceptance Criteria
1. System returns direct alternatives within interactive latency.
2. When direct alternative is impossible, engine returns valid one-step reassignment options when they exist.
3. Returned suggestions are explainable and ranked.
4. Apply action never creates overlap.
5. Agent can apply only within allowed scope.
6. Every apply creates audit record and manager alert.
7. Failed apply leaves data unchanged.
8. Algorithm behavior is deterministic for same inputs and same state.

---

## Open Decisions
1. Start with own-only scope for agent applies, or branch scope?
2. Are downgrades always forbidden, or allowed with manager override?
3. Should the engine optimize for revenue first or disruption first?
4. Should same-day reassignments require manager approval instead of only notification?

