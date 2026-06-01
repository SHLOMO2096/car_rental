import { useEffect, useState } from "react";
import { pricingAPI } from "../../../api/pricing";

export function useBookingPricePreview({ form, carsMap }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const carId = form?.car_id ? Number(form.car_id) : null;
  const startDate = form?.start_date;
  const endDate = form?.end_date;
  const pickupTime = form?.start_time || null;
  const returnTime = form?.end_time || null;

  useEffect(() => {
    if (!carId || !startDate || !endDate || endDate < startDate) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    pricingAPI
      .calculate({
        vehicle_id: carId,
        rental_start: startDate,
        rental_end: endDate,
        pickup_time: pickupTime,
        return_time: returnTime,
      })
      .then((data) => {
        if (!cancelled) {
          setResult(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [carId, startDate, endDate, pickupTime, returnTime]);

  const previewCar = carId ? carsMap?.[carId] : null;

  return {
    result,
    loading,
    show: !!previewCar && (loading || !!result),
  };
}
