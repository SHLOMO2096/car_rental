import { useMemo } from "react";

import { todayISO, tomorrowISO } from "../utils/dates";

/**
 * מרכז את חישובי התצוגה (carsMap, activeDateStr, filtered, paginated, totalPages)
 * כדי לשמור את BookingsPage נקי יותר.
 */
export function useBookingsFiltering({ bookings, cars, search, statusFilter, dateFilter, customDate, page, perPage }) {
  const carsMap = useMemo(() => Object.fromEntries((cars || []).map((c) => [c.id, c])), [cars]);

  const activeDateStr = useMemo(() => {
    if (dateFilter === "today") return todayISO();
    if (dateFilter === "tomorrow") return tomorrowISO();
    if (dateFilter === "custom") return customDate;
    return null;
  }, [customDate, dateFilter]);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();

    return (bookings || []).filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;

      if (activeDateStr) {
        if (b.start_date > activeDateStr || b.end_date < activeDateStr) return false;
      }

      if (q) {
        const car = carsMap[b.car_id];
        const customerName = (b.customer_name || "").toLowerCase();
        const customerPhone = String(b.customer_phone || "");
        const customerIdNum = String(b.customer_id_num || "");
        const carName = String(car?.name || "").toLowerCase();

        if (!customerName.includes(q) && !customerPhone.includes(q) && !carName.includes(q) && !customerIdNum.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [activeDateStr, bookings, carsMap, search, statusFilter]);

  const totalPages = useMemo(() => Math.ceil(filtered.length / perPage), [filtered.length, perPage]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  return {
    carsMap,
    activeDateStr,
    filtered,
    paginated,
    totalPages,
  };
}

