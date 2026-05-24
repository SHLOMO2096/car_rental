import { describe, expect, it } from "vitest";

import { Permissions } from "../permissions";
import { createDashboardPermissionModel } from "../pages/dashboardPermissions";

function makeCan(allowed = []) {
  const set = new Set(allowed);
  return (permission) => set.has(permission);
}

describe("dashboard permission model", () => {
  it("allows desktop agent to create, edit, delete and reassign any booking when permissions exist", () => {
    const currentUser = { id: 7, role: "agent" };
    const model = createDashboardPermissionModel({
      can: makeCan([
        Permissions.BOOKINGS_CREATE,
        Permissions.BOOKINGS_UPDATE,
        Permissions.BOOKINGS_DELETE,
        Permissions.CUSTOMERS_VIEW,
      ]),
      currentUser,
      isMobile: false,
    });

    expect(model.canCreateBookings).toBe(true);
    expect(model.canEditBooking({ created_by: 5 })).toBe(true);
    expect(model.canReassignBooking({ created_by: 5 })).toBe(true);
    expect(model.canDragReassignBooking({ created_by: 5 })).toBe(true);
    expect(model.canDeleteBooking({ created_by: 7 })).toBe(true);
    expect(model.canDeleteBooking({ created_by: 5 })).toBe(true);
    expect(model.requiresOperatorNote({ created_by: 5 })).toBe(true);
  });

  it("rejects booking actions when there is no booking object", () => {
    const model = createDashboardPermissionModel({
      can: makeCan([
        Permissions.BOOKINGS_UPDATE,
        Permissions.BOOKINGS_DELETE,
        Permissions.CUSTOMERS_VIEW,
      ]),
      currentUser: { id: 7, role: "agent" },
      isMobile: false,
    });

    expect(model.canEditBooking(null)).toBe(false);
    expect(model.canDeleteBooking(undefined)).toBe(false);
    expect(model.canManageBookingMedia(null)).toBe(false);
    expect(model.canReassignBooking(undefined)).toBe(false);
    expect(model.hasAnyBookingActions(null)).toBe(false);
  });

  it("keeps move actions on mobile but disables drag-based reassign", () => {
    const model = createDashboardPermissionModel({
      can: makeCan([Permissions.BOOKINGS_UPDATE]),
      currentUser: { id: 3, role: "agent" },
      isMobile: true,
    });

    expect(model.canEditBooking({ created_by: 3 })).toBe(true);
    expect(model.canReassignBooking({ created_by: 3 })).toBe(true);
    expect(model.canDragReassignBooking({ created_by: 3 })).toBe(false);
  });

  it("counts customer access as a valid dashboard action when a linked customer exists", () => {
    const model = createDashboardPermissionModel({
      can: makeCan([Permissions.CUSTOMERS_VIEW]),
      currentUser: { id: 1, role: "agent" },
      isMobile: false,
    });

    expect(model.hasAnyBookingActions({ customer_id: 12 })).toBe(true);
    expect(model.hasAnyBookingActions({ customer_id: null })).toBe(false);
  });

  it("requires an operator note only when an agent acts on another agent's booking", () => {
    const model = createDashboardPermissionModel({
      can: makeCan([Permissions.BOOKINGS_UPDATE]),
      currentUser: { id: 10, role: "agent" },
      isMobile: false,
    });

    expect(model.requiresOperatorNote({ created_by: 10 })).toBe(false);
    expect(model.requiresOperatorNote({ created_by: 11 })).toBe(true);
    expect(model.requiresOperatorNote({ created_by: 11, customer_id: 3 })).toBe(true);
  });
});

