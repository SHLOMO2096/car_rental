export const Permissions = {
  CARS_MANAGE: "cars:manage",
  REPORTS_VIEW: "reports:view",
  USERS_MANAGE: "users:manage",
  BOOKINGS_DELETE: "bookings:delete",
  SUGGESTIONS_VIEW: "suggestions:view",
  SUGGESTIONS_APPLY: "suggestions:apply",
};

const ROLE_PERMISSIONS = {
  admin: new Set([
    Permissions.CARS_MANAGE,
    Permissions.REPORTS_VIEW,
    Permissions.USERS_MANAGE,
    Permissions.BOOKINGS_DELETE,
    Permissions.SUGGESTIONS_VIEW,
    Permissions.SUGGESTIONS_APPLY,
  ]),
  agent: new Set([
    Permissions.BOOKINGS_DELETE,
    Permissions.SUGGESTIONS_VIEW,
    Permissions.SUGGESTIONS_APPLY,
  ]),
};

export function roleCan(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) || false;
}

