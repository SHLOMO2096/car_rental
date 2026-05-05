import { useCallback, useEffect, useState } from "react";

import { getUserFacingErrorMessage } from "../../../api/errors";
import { toast } from "../../../store/toast";
import { DEFAULT_GENERAL_SETTINGS } from "../../../config/defaultSettings";

/**
 * טוען את כל נתוני המסך של Bookings: הזמנות, רכבים והגדרות.
 * מחזיר גם load() לרענון.
 */
export function useBookingsData({ bookingsAPI, carsAPI, settingsAPI }) {
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  const [generalSettings, setGeneralSettings] = useState(() => ({ ...DEFAULT_GENERAL_SETTINGS }));
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

    if (genRes.status === "fulfilled") {
      if (genRes.value?.value) {
        // Merge so missing keys keep sane defaults.
        setGeneralSettings({ ...DEFAULT_GENERAL_SETTINGS, ...genRes.value.value });
      } else {
        setGeneralSettings({ ...DEFAULT_GENERAL_SETTINGS });
      }
    } else {
      // If the setting doesn't exist yet (404) we still want the UI defaults.
      setGeneralSettings({ ...DEFAULT_GENERAL_SETTINGS });
      if (genRes.reason?.status && genRes.reason.status !== 404) {
        toast.error(getUserFacingErrorMessage(genRes.reason), { title: "טעינת הגדרות" });
      }
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

