import { useCallback, useEffect, useState } from "react";

/**
 * Autocomplete ללקוחות בזמן יצירת הזמנה חדשה.
 * כולל debounce, מצב טעינה, וניקוי תוצאות.
 */
export function useCustomerAutocomplete({
  modal,
  customerId,
  customerName,
  searchCustomers,
  limit = 8,
  debounceMs = 180,
  minChars = 2,
}) {
  const [customerMatches, setCustomerMatches] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const clearCustomerMatches = useCallback(() => {
    setCustomerMatches([]);
  }, []);

  useEffect(() => {
    if (modal !== "create" || customerId) return;

    const q = (customerName || "").trim();
    if (q.length < minChars) {
      setCustomerMatches([]);
      return;
    }

    const id = setTimeout(async () => {
      setCustomersLoading(true);
      try {
        const rows = await searchCustomers(q, limit);
        setCustomerMatches(rows || []);
      } catch {
        setCustomerMatches([]);
      } finally {
        setCustomersLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(id);
  }, [customerId, customerName, debounceMs, limit, minChars, modal, searchCustomers]);

  return {
    customerMatches,
    customersLoading,
    clearCustomerMatches,
  };
}

