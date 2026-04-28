from app.models.user import UserRole


class Permissions:
    BOOKINGS_VIEW = "bookings:view"
    BOOKINGS_CREATE = "bookings:create"
    BOOKINGS_UPDATE = "bookings:update"
    BOOKINGS_CANCEL = "bookings:cancel"
    BOOKINGS_DELETE = "bookings:delete"

    CARS_VIEW = "cars:view"
    CARS_MANAGE = "cars:manage"

    REPORTS_VIEW = "reports:view"
    USERS_MANAGE = "users:manage"

    SUGGESTIONS_VIEW = "suggestions:view"
    SUGGESTIONS_APPLY = "suggestions:apply"
    AUDIT_VIEW = "audit:view"


ROLE_PERMISSIONS = {
    UserRole.agent: {
        Permissions.BOOKINGS_VIEW,
        Permissions.BOOKINGS_CREATE,
        Permissions.BOOKINGS_UPDATE,
        Permissions.BOOKINGS_CANCEL,
        Permissions.BOOKINGS_DELETE,
        Permissions.CARS_VIEW,
        Permissions.REPORTS_VIEW,        # agent sees own reports in dashboard
        Permissions.SUGGESTIONS_VIEW,
        Permissions.SUGGESTIONS_APPLY,   # agent can apply within scope
    },
    UserRole.admin: {
        Permissions.BOOKINGS_VIEW,
        Permissions.BOOKINGS_CREATE,
        Permissions.BOOKINGS_UPDATE,
        Permissions.BOOKINGS_CANCEL,
        Permissions.BOOKINGS_DELETE,
        Permissions.CARS_VIEW,
        Permissions.CARS_MANAGE,
        Permissions.REPORTS_VIEW,
        Permissions.USERS_MANAGE,
        Permissions.SUGGESTIONS_VIEW,
        Permissions.SUGGESTIONS_APPLY,
        Permissions.AUDIT_VIEW,
    },
}

