import { describe, expect, it } from "vitest";

import { makeEmptyForm } from "../features/bookings/utils/form";

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
});

