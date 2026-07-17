import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildBookingPayload,
  clampTimeValue,
  getEarliestAllowedPickupTime,
  isBookingStartInPast,
  makeEmptyForm,
  sanitizeTimeTyping,
  subtractMinutes,
} from "../features/bookings/utils/form";


beforeEach(() => {
  vi.useFakeTimers();
});


afterEach(() => {
  vi.useRealTimers();
});

describe("Bookings makeEmptyForm defaults", () => {
  it("defaults pickup and return time to the same current rounded time", () => {
    vi.setSystemTime(new Date("2026-05-18T08:30:00"));
    const form = makeEmptyForm();
    expect(form.start_time).toBe("08:30");
    expect(form.end_time).toBe("08:30");
  });

  it("rounds pickup time up to next 30-min slot and mirrors it to return time", () => {
    vi.setSystemTime(new Date("2026-05-18T10:07:00"));
    const form = makeEmptyForm();
    expect(form.start_time).toBe("10:30");
    expect(form.end_time).toBe("10:30");
  });

  it("subtractMinutes returns correct time and clamps at 00:00", () => {
    expect(subtractMinutes("08:30", 30)).toBe("08:00");
    expect(subtractMinutes("10:00", 30)).toBe("09:30");
    expect(subtractMinutes("00:15", 30)).toBe("00:00");
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

  it("sanitizeTimeTyping keeps partial input and inserts the colon after 2 digits", () => {
    expect(sanitizeTimeTyping("")).toBe("");
    expect(sanitizeTimeTyping("9")).toBe("9");
    expect(sanitizeTimeTyping("09")).toBe("09");
    expect(sanitizeTimeTyping("093")).toBe("09:3");
    expect(sanitizeTimeTyping("0930")).toBe("09:30");
    expect(sanitizeTimeTyping("09:30")).toBe("09:30");
    expect(sanitizeTimeTyping("09305")).toBe("09:30");
  });

  it("clampTimeValue normalizes to valid 24h HH:MM on blur", () => {
    expect(clampTimeValue("0930")).toBe("09:30");
    expect(clampTimeValue("9")).toBe("09:00");
    expect(clampTimeValue("99:99")).toBe("23:59");
    expect(clampTimeValue("2500")).toBe("23:00");
    expect(clampTimeValue("")).toBe("00:00");
    expect(clampTimeValue("", "08:00")).toBe("08:00");
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

