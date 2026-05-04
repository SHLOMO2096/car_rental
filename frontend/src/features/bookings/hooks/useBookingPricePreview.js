import { useMemo } from "react";

/**
 * מחשב תצוגה מקדימה למחיר הזמנה לפי רכב, קטגוריה ו-grace period.
 * נשמר כאן כדי להוציא לוגיקה חישובית מ-BookingsPage.
 */
export function useBookingPricePreview({ form, carsMap, categories, generalSettings }) {
  return useMemo(() => {
    const previewCar = form?.car_id ? carsMap?.[Number(form.car_id)] : null;

    const startDt = new Date(`${form?.start_date}T${form?.start_time || "00:00"}`);
    const endDt = new Date(`${form?.end_date}T${form?.end_time || "00:00"}`);
    const diffMs = endDt - startDt;
    const graceMs = (Number(generalSettings?.grace_period_hours) || 0) * 3600000;
    const days = isNaN(diffMs) || diffMs <= 0 ? 0 : Math.ceil((diffMs - graceMs) / 86400000);

    let pricePerDay = previewCar?.price_per_day || 0;
    if (!pricePerDay && previewCar?.category) {
      const carCat = (categories || []).find((c) => c.name === previewCar.category);
      if (carCat) {
        pricePerDay = previewCar.is_hybrid
          ? Number(carCat.hybrid_price) || Number(carCat.base_price)
          : Number(carCat.base_price);
      }
    }

    const total = pricePerDay * days;

    return {
      previewCar,
      days,
      pricePerDay,
      total,
      show: !!previewCar && days > 0 && pricePerDay > 0,
    };
  }, [carsMap, categories, form?.car_id, form?.end_date, form?.end_time, form?.start_date, form?.start_time, generalSettings]);
}

