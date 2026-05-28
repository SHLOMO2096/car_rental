export const Permissions = {
  BOOKINGS_CREATE: "bookings:create",
  BOOKINGS_UPDATE: "bookings:update",
  CARS_MANAGE: "cars:manage",
  CARS_DELETE: "cars:delete",
  CUSTOMERS_VIEW: "customers:view",
  CUSTOMERS_MANAGE: "customers:manage",
  CUSTOMERS_BULK_EMAIL: "customers:bulk_email",
  REPORTS_VIEW: "reports:view",
  USERS_MANAGE: "users:manage",
  BOOKINGS_DELETE: "bookings:delete",
  SUGGESTIONS_VIEW: "suggestions:view",
  SUGGESTIONS_APPLY: "suggestions:apply",

  ATTENDANCE_CLOCK: "attendance:clock",
  ATTENDANCE_VIEW: "attendance:view",
  ATTENDANCE_VIEW_ALL: "attendance:view_all",
  ATTENDANCE_MANAGE: "attendance:manage",

  PAYROLL_VIEW: "payroll:view",
  PAYROLL_MANAGE: "payroll:manage",
};

const ROLE_PERMISSIONS = {
  admin: new Set([
    Permissions.BOOKINGS_CREATE,
    Permissions.BOOKINGS_UPDATE,
    Permissions.CARS_MANAGE,
    Permissions.CARS_DELETE,
    Permissions.CUSTOMERS_VIEW,
    Permissions.CUSTOMERS_MANAGE,
    Permissions.CUSTOMERS_BULK_EMAIL,
    Permissions.REPORTS_VIEW,
    Permissions.USERS_MANAGE,
    Permissions.BOOKINGS_DELETE,
    Permissions.SUGGESTIONS_VIEW,
    Permissions.SUGGESTIONS_APPLY,

    Permissions.ATTENDANCE_CLOCK,
    Permissions.ATTENDANCE_VIEW,
    Permissions.ATTENDANCE_VIEW_ALL,
    Permissions.ATTENDANCE_MANAGE,

    Permissions.PAYROLL_VIEW,
    Permissions.PAYROLL_MANAGE,
  ]),
  agent: new Set([
    Permissions.BOOKINGS_CREATE,
    Permissions.BOOKINGS_UPDATE,
    Permissions.CARS_MANAGE,
    Permissions.CUSTOMERS_VIEW,
    Permissions.CUSTOMERS_MANAGE,
    Permissions.BOOKINGS_DELETE,
    Permissions.SUGGESTIONS_VIEW,
    Permissions.SUGGESTIONS_APPLY,

    Permissions.ATTENDANCE_CLOCK,
    Permissions.ATTENDANCE_VIEW,
  ]),
};

export function roleCan(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) || false;
}

