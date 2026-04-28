# RBAC v2 Spec (Kickoff)

## Goal
Enable fast operational work for agents while keeping strict administrative control, auditability, and production-grade security.

## Roles
- `agent`: operational user for bookings workflow.
- `admin`: full management, analytics, and security authority.

## Permission Matrix
| Area | Action | Agent | Admin |
|---|---|---:|---:|
| Dashboard | View operational dashboard | Yes | Yes |
| Cars | View cars and availability | Yes | Yes |
| Cars | Create/Edit/Deactivate cars | No | Yes |
| Bookings | List bookings | Yes (scope-limited) | Yes (all) |
| Bookings | Create booking | Yes | Yes |
| Bookings | Edit booking | Yes (scope-limited) | Yes (all) |
| Bookings | Cancel booking | Yes (scope-limited) | Yes (all) |
| Bookings | Hard delete booking | No | Yes |
| Suggestions | View smart alternatives | Yes | Yes |
| Suggestions | Apply reassignment plan | No (request only) | Yes |
| Reports | View analytics and financial reports | No | Yes |
| Users | Manage users/roles/status | No | Yes |
| Security | View audit/security events | No | Yes |

## Scope Rules (initial)
- Agent scope: `own bookings only` (created_by == current_user.id).
- Admin scope: all records.
- Future extension: branch/team scope via `branch_id`.

## Guardrails
1. Deny-by-default for any new endpoint unless explicitly mapped.
2. Backend enforcement is mandatory; frontend gating is UX-only.
3. No privilege escalation by non-admin users.
4. Smart suggestions are advisory and non-destructive by default.
5. Hard delete allowed only for admin and only for future bookings; otherwise use cancel.
6. Every sensitive mutation creates an audit event.

## Security Event Alerts (Email)
Send alert emails to admin/security recipients for:
1. Role change (`agent` <-> `admin`).
2. User deactivation/reactivation.
3. Booking hard delete.
4. Booking reassignment override by admin.
5. Forbidden access spikes (repeated 401/403 from same actor/IP).
6. High-rate cancellations by same actor in short window.

## Backend Design

### Permission constants
Create central permission keys (example):
- `bookings:view:own`
- `bookings:create`
- `bookings:update:own`
- `bookings:cancel:own`
- `bookings:delete:any`
- `cars:view`
- `cars:manage`
- `reports:view`
- `users:manage`
- `audit:view`
- `suggestions:view`
- `suggestions:apply`

### Policy map
Map role -> permission set in one central module (`app/core/security.py` or dedicated `app/core/permissions.py`).

### Dependencies
Add reusable dependencies:
- `require_permission(permission_key)`
- `require_booking_scope_or_admin(booking_id)`
- Keep `require_admin` for admin-only endpoints.

### Audit log
Add `audit_logs` table:
- `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`,
- `before_json`, `after_json`, `ip_address`, `created_at`, `severity`.

### Alert pipeline
- Emit domain events from mutation paths.
- Send email asynchronously (background task/worker).
- Store delivery status and retry failures.

## Frontend Design
1. Keep route guards in `App.jsx` (`AdminRoute`, `AgentRoute`).
2. Add permission-aware UI gating for buttons/actions.
3. Hide unauthorized actions, but rely on backend for hard enforcement.
4. Show clear forbidden message when API returns 403.

## API Behavior Standards
- `401`: not authenticated.
- `403`: authenticated but not authorized.
- `409`: conflict (overlap/business constraints).
- Include structured `detail` message for operator guidance.

## Acceptance Criteria (v1)
1. Agent cannot access reports/users endpoints or pages.
2. Agent can create/update/cancel only own bookings.
3. Agent cannot hard delete bookings.
4. Admin can fully manage users and perform booking hard delete.
5. Security-sensitive actions create audit records.
6. Alert emails are triggered for configured events.
7. Existing login flow remains backward-compatible.

## Implementation Phases

### Phase 1 - Policy foundation
- Add central permission map and route dependencies.
- Enforce backend permission checks on all existing routers.

### Phase 2 - Scope + audit
- Add booking scope checks and audit log persistence.
- Add tests for 401/403 and scope boundaries.

### Phase 3 - Alerts
- Add event emission + email alerts.
- Add retry and observability for failed sends.

### Phase 4 - Smart suggestions governance
- Expose suggestions to agents.
- Keep reassignment apply action admin-only until confidence is high.

## Test Plan
- Unit tests: permission map and scope evaluators.
- API tests: role access matrix per endpoint.
- Integration tests: booking mutation creates audit log.
- Alert tests: trigger -> email queued/sent.

## Open Decisions
1. Do agents need team/branch scope immediately, or own-only first?
2. Should hard delete be disabled entirely in production and replaced with cancel?
3. Who receives security emails (single mailbox vs distribution list)?

