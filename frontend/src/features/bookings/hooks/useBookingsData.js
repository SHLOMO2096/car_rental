import { useCallback, useEffect, useState } from "react";

import { getUserFacingErrorMessage } from "../../../api/errors";
import { toast } from "../../../store/toast";

/**
 * טוען את כל נתוני המסך של Bookings: הזמנות, רכבים והגדרות.
 * מחזיר גם load() לרענון.
 */
export function useBookingsData({ bookingsAPI, carsAPI, settingsAPI }) {
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  const [generalSettings, setGeneralSettings] = useState(null);
  const [categories, setCategories] = useState([]);

  const load = useCallback(async () => {
    const [bookingsRes, carsRes, genRes, pricesRes] = await Promise.allSettled([
      bookingsAPI.list(),
      carsAPI.list({ active_only: false }),
      settingsAPI.get("general_settings"),
      settingsAPI.get("category_hierarchy"),
    ]);

    if (bookingsRes.status === "fulfilled") {
      setBookings(bookingsRes.value || []);
    } else {
      setBookings([]);
      toast.error(getUserFacingErrorMessage(bookingsRes.reason), { title: "טעינת הזמנות" });
    }

    if (carsRes.status === "fulfilled") {
      setCars(carsRes.value || []);
    } else {
      setCars([]);
      toast.error(getUserFacingErrorMessage(carsRes.reason), { title: "טעינת רכבים" });
    }

    if (genRes.status === "fulfilled" && genRes.value?.value) {
      setGeneralSettings(genRes.value.value);
    }
    if (pricesRes.status === "fulfilled" && pricesRes.value?.value) {
      setCategories(pricesRes.value.value);
    }

    setLoading(false);
  }, [bookingsAPI, carsAPI, settingsAPI]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    bookings,
    cars,
    loading,
    generalSettings,
    categories,
    load,
  };
}

