import { useCallback } from "react";

import { getUserFacingErrorMessage } from "../../../api/errors";
import { toast } from "../../../store/toast";
import { addDays } from "../utils/dates";

/**
 * מרכז פעולות "מהירות" על הזמנה כדי להשאיר את BookingsPage רזה.
 */
export function useBookingQuickActions({ bookingsAPI, load, search }) {
  const handleQuickComplete = useCallback(
	async (b) => {
	  try {
		await bookingsAPI.update(b.id, { ...b, status: "completed" });
		toast.success("הזמנה סומנה כהושלמה");
		// load currently ignores args; we keep the call signature as-is.
		load(search?.trim?.());
	  } catch (e) {
		toast.error(getUserFacingErrorMessage(e));
	  }
	},
	[bookingsAPI, load, search],
  );

  const handleQuickExtend = useCallback(
	async (b) => {
	  try {
		const newEnd = addDays(b.end_date, 1);
		await bookingsAPI.update(b.id, { ...b, end_date: newEnd });
		toast.success("הזמנה הוארכה ביום אחד");
		load(search?.trim?.());
	  } catch (e) {
		toast.error(getUserFacingErrorMessage(e));
	  }
	},
	[bookingsAPI, load, search],
  );

  const isBookingOverdue = useCallback((b) => {
	if (b.status !== "active") return false;
	const endDateStr = b.end_date;
	const endTimeStr = b.return_time || "08:00";
	const endDateTime = new Date(`${endDateStr}T${endTimeStr}`);
	return endDateTime < new Date();
  }, []);

  return {
	handleQuickComplete,
	handleQuickExtend,
	isBookingOverdue,
  };
}


