# Changelog

All notable changes to this project are documented in this file.

## [2.0.0] - 2026-04-30

### Added
- Admin-only permanent car deletion flow in UI and API.
  - Frontend action button in `frontend/src/pages/Cars.jsx`.
  - Backend endpoint `DELETE /cars/{car_id}/permanent` in `backend/app/routers/cars.py`.
- Customer bulk email campaign workflow from Customers screen.
  - Bulk send modal and action in `frontend/src/pages/Customers.jsx`.
  - API endpoint `POST /customers/send-bulk-email` in `backend/app/routers/customers.py`.
- Audience targeting for bulk email campaigns.
  - `all`: all customers with email.
  - `active`: customers with active bookings.
  - `with_bookings`: customers with booking history.
- Ready-made marketing templates for campaign emails (promotions, holiday notice, opening hours, reminders, win-back).
- Rich text editor for campaign content (bold, italic, underline, heading, bullet/numbered lists, clear formatting).

### Changed
- Booking create UI copy simplified when customer has no email.
  - Removed explicit alert wording from form text while keeping backend behavior intact.
  - Updated in `frontend/src/pages/Bookings.jsx`.
- Email message rendering upgraded to support both plain text and HTML bodies.
  - Updated in `backend/app/core/email.py`.
- Dashboard filter controls visual alignment improved.
  - Date inputs and model select now share consistent control height.
  - Updated in `frontend/src/pages/Dashboard.jsx`.

### Security and Permissions
- Permanent car deletion remains protected by `Permissions.CARS_DELETE`.
- Bulk email remains protected by `Permissions.CUSTOMERS_BULK_EMAIL`.

### Notes
- Version updated to `2.0.0` in:
  - `backend/app/core/config.py` (`APP_VERSION`)
  - `frontend/package.json`
  - `frontend/package-lock.json`

