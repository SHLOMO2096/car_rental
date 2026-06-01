from app.models.user import UserRole


class Permissions:
    BOOKINGS_VIEW = "bookings:view"
    BOOKINGS_CREATE = "bookings:create"
    BOOKINGS_UPDATE = "bookings:update"
    BOOKINGS_CANCEL = "bookings:cancel"
    BOOKINGS_DELETE = "bookings:delete"

    CARS_VIEW = "cars:view"
    CARS_MANAGE = "cars:manage"
    CARS_DELETE = "cars:delete"
    CUSTOMERS_VIEW = "customers:view"
    CUSTOMERS_MANAGE = "customers:manage"
    CUSTOMERS_BULK_EMAIL = "customers:bulk_email"

    REPORTS_VIEW = "reports:view"
    USERS_MANAGE = "users:manage"

    SUGGESTIONS_VIEW = "suggestions:view"
    SUGGESTIONS_APPLY = "suggestions:apply"
    AUDIT_VIEW = "audit:view"

    ATTENDANCE_CLOCK = "attendance:clock"
    ATTENDANCE_VIEW = "attendance:view"
    ATTENDANCE_VIEW_ALL = "attendance:view_all"
    ATTENDANCE_MANAGE = "attendance:manage"

    PAYROLL_VIEW = "payroll:view"
    PAYROLL_MANAGE = "payroll:manage"

    PRICING_VIEW = "pricing:view"
    PRICING_MANAGE = "pricing:manage"


ROLE_PERMISSIONS = {
    UserRole.agent: {
        Permissions.BOOKINGS_VIEW,
        Permissions.BOOKINGS_CREATE,
        Permissions.BOOKINGS_UPDATE,
        Permissions.BOOKINGS_CANCEL,
        Permissions.BOOKINGS_DELETE,
        Permissions.CARS_VIEW,
        Permissions.CARS_MANAGE,
        Permissions.CUSTOMERS_VIEW,
        Permissions.CUSTOMERS_MANAGE,
        # Reports/analytics are manager-only (admins)
        Permissions.SUGGESTIONS_VIEW,
        Permissions.SUGGESTIONS_APPLY,   # agent can apply within scope

        Permissions.ATTENDANCE_CLOCK,
        Permissions.ATTENDANCE_VIEW,

        Permissions.PRICING_VIEW,        # agent רואה מחירים
    },
    UserRole.admin: {
        Permissions.BOOKINGS_VIEW,
        Permissions.BOOKINGS_CREATE,
        Permissions.BOOKINGS_UPDATE,
        Permissions.BOOKINGS_CANCEL,
        Permissions.BOOKINGS_DELETE,
        Permissions.CARS_VIEW,
        Permissions.CARS_MANAGE,
        Permissions.CARS_DELETE,
        Permissions.CUSTOMERS_VIEW,
        Permissions.CUSTOMERS_MANAGE,
        Permissions.CUSTOMERS_BULK_EMAIL,
        Permissions.REPORTS_VIEW,
        Permissions.USERS_MANAGE,
        Permissions.SUGGESTIONS_VIEW,
        Permissions.SUGGESTIONS_APPLY,
        Permissions.AUDIT_VIEW,

        Permissions.ATTENDANCE_CLOCK,
        Permissions.ATTENDANCE_VIEW,
        Permissions.ATTENDANCE_VIEW_ALL,
        Permissions.ATTENDANCE_MANAGE,

        Permissions.PAYROLL_VIEW,
        Permissions.PAYROLL_MANAGE,

        Permissions.PRICING_VIEW,        # admin מנהל מחירים
        Permissions.PRICING_MANAGE,
    },
}

