import { Permissions } from "../permissions";

export function createDashboardPermissionModel({ can, currentUser, isMobile }) {
  const safeCan = typeof can === "function" ? can : () => false;
  const canCreateBookings = safeCan(Permissions.BOOKINGS_CREATE);
  const canEditBookings = safeCan(Permissions.BOOKINGS_UPDATE);
  const canDeleteBookings = safeCan(Permissions.BOOKINGS_DELETE);
  const canViewCustomers = safeCan(Permissions.CUSTOMERS_VIEW);

  function canEditBooking() {
    return canEditBookings;
  }

  function canDeleteBooking(booking) {
    return canDeleteBookings && Boolean(booking);
  }

  function canViewBookingCustomer(booking) {
    return canViewCustomers && Boolean(booking?.customer_id);
  }

  function canManageBookingMedia(booking) {
    return canEditBooking(booking);
  }

  function canReassignBooking(booking) {
    return canEditBooking(booking);
  }

  function canDragReassignBooking(booking) {
    return !isMobile && canReassignBooking(booking);
  }

  function requiresOperatorNote(booking) {
    return Boolean(
      currentUser?.role === "agent" &&
      currentUser?.id &&
      booking?.created_by &&
      booking.created_by !== currentUser.id
    );
  }

  function hasAnyBookingActions(booking) {
    return Boolean(
      canEditBooking(booking) ||
        canReassignBooking(booking) ||
      canDeleteBooking(booking) ||
      canViewBookingCustomer(booking) ||
      canManageBookingMedia(booking)
    );
  }

  return {
    canCreateBookings,
    canEditBookings,
    canDeleteBookings,
    canViewCustomers,
    canEditBooking,
    canDeleteBooking,
    canViewBookingCustomer,
    canManageBookingMedia,
    canReassignBooking,
    canDragReassignBooking,
    requiresOperatorNote,
    hasAnyBookingActions,
  };
}

