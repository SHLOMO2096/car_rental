import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildBookingPayload,
  getEarliestAllowedPickupTime,
  isBookingStartInPast,
  makeEmptyForm,
} from "../features/bookings/utils/form";


beforeEach(() => {
  vi.useFakeTimers();
});


afterEach(() => {
  vi.useRealTimers();
});

describe("Bookings makeEmptyForm defaults", () => {
  it("defaults pickup time to 08:30 and return time to 08:00 when no settings are provided", () => {
    const form = makeEmptyForm({});
    expect(form.start_time).toBe("08:30");
    expect(form.end_time).toBe("08:00");
  });

  it("uses provided general_settings overrides", () => {
    const form = makeEmptyForm({ default_pickup_time: "09:15", default_return_time: "18:45" });
    expect(form.start_time).toBe("09:15");
    expect(form.end_time).toBe("18:45");
  });

  it("bumps same-day prefills to the next allowed pickup slot", () => {
    vi.setSystemTime(new Date("2026-05-18T18:07:00"));
    expect(getEarliestAllowedPickupTime("2026-05-18", new Date(), "08:30")).toBe("18:30");
  });

  it("keeps future-day pickup times unchanged", () => {
    vi.setSystemTime(new Date("2026-05-18T18:07:00"));
    expect(getEarliestAllowedPickupTime("2026-05-19", new Date(), "08:30")).toBe("08:30");
  });

  it("detects when a same-day booking starts in the past", () => {
    vi.setSystemTime(new Date("2026-05-18T18:07:00"));
    expect(isBookingStartInPast({ start_date: "2026-05-18", start_time: "08:30" }, new Date())).toBe(true);
    expect(isBookingStartInPast({ start_date: "2026-05-18", start_time: "18:30" }, new Date())).toBe(false);
  });

  it("includes operator_note only for booking updates", () => {
    const form = {
      ...makeEmptyForm({}),
      customer_name: "לקוח",
      customer_email: "a@test.com",
      operator_note: "עריכה של סוכן אחר",
    };

    expect(buildBookingPayload(form, 1, { mode: "create" }).operator_note).toBeUndefined();
    expect(buildBookingPayload(form, 1, { mode: "edit" }).operator_note).toBe("עריכה של סוכן אחר");
  });
});

