import { Permissions } from "../permissions";

export function createDashboardPermissionModel({ can, currentUser, isMobile }) {
  const safeCan = typeof can === "function" ? can : () => false;
  const canCreateBookings = safeCan(Permissions.BOOKINGS_CREATE);
  const canEditBookings = safeCan(Permissions.BOOKINGS_UPDATE);
  const canDeleteBookings = safeCan(Permissions.BOOKINGS_DELETE);
  const canViewCustomers = safeCan(Permissions.CUSTOMERS_VIEW);

  const hasBooking = (booking) => Boolean(booking);
  const canModifyBooking = (booking) => canEditBookings && hasBooking(booking);

  function canEditBooking(booking) {
    return canModifyBooking(booking);
  }

  function canDeleteBooking(booking) {
    return canDeleteBookings && hasBooking(booking);
  }

  function canViewBookingCustomer(booking) {
    return canViewCustomers && Boolean(booking?.customer_id);
  }

  function canManageBookingMedia(booking) {
    return canModifyBooking(booking);
  }

  function canReassignBooking(booking) {
    return canModifyBooking(booking);
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

