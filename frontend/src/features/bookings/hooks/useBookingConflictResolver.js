import { useCallback, useState } from "react";

import { getUserFacingErrorMessage } from "../../../api/errors";
import { toast } from "../../../store/toast";
import { overlaps } from "../utils/bookingMath";
import { ensureMinWeek } from "../utils/dates";
import { buildBookingPayload } from "../utils/form";

/**
 * מרכז את כל לוגיקת פתרון ההתנגשויות (409) בעת יצירת הזמנה:
 * - טעינת calendar לטווח
 * - פתיחת מודאל ConflictResolver
 * - גרירה/שחרור להעברת הזמנה קיימת או הזמנה חדשה לרכב אחר
 */
export function useBookingConflictResolver({
  bookingsAPI,
  cars,
  form,
  load,
  setModal,
  setFormError,
  askActionConfirm,
}) {
  const [conflictModal, setConflictModal] = useState(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [dragOverCarId, setDragOverCarId] = useState(null);

  const clearConflict = useCallback(() => {
    setConflictModal(null);
    setDragItem(null);
    setDragOverCarId(null);
  }, []);

  const closeConflictModal = useCallback(() => {
    if (resolvingConflict) return;
    clearConflict();
  }, [clearConflict, resolvingConflict]);

  const openConflictResolver = useCallback(async () => {
    const requestedCarId = Number(form.car_id);
    const requestedStart = form.start_date;
    const requestedEnd = form.end_date;
    const safeRange = ensureMinWeek(requestedStart, requestedEnd);
    const viewStart = safeRange.startIso;
    const viewEnd = safeRange.endIso;

    try {
      const calendar = await bookingsAPI.calendar(viewStart, viewEnd);
      const activeBookings = (calendar || []).filter((b) => b.status !== "cancelled");
      const blockers = activeBookings.filter(
        (b) => b.car_id === requestedCarId && overlaps(b.start_date, b.end_date, requestedStart, requestedEnd),
      );
      const requestedCar = (cars || []).find((c) => c.id === requestedCarId);

      setConflictModal({
        requestedCarId,
        requestedCarName: requestedCar
          ? `${requestedCar.name} (#${requestedCar.id}${requestedCar.plate ? ` · ${requestedCar.plate}` : ""})`
          : `#${requestedCarId}`,
        requestedStart,
        requestedEnd,
        viewStart,
        viewEnd,
        modelFilter: [],
        categoryFilter: [],
        bookings: activeBookings,
        blockers,
      });

      setFormError("הרכב תפוס. אפשר לפתור בגרירה: להעביר הזמנה קיימת או להעביר את ההזמנה החדשה לרכב אחר.");
    } catch (e) {
      setFormError(getUserFacingErrorMessage(e));
    }
  }, [bookingsAPI, cars, form.car_id, form.end_date, form.start_date, setFormError]);

  const refreshConflictModal = useCallback(async () => {
    if (!conflictModal) return;
    try {
      const calendar = await bookingsAPI.calendar(conflictModal.viewStart, conflictModal.viewEnd);
      const activeBookings = (calendar || []).filter((b) => b.status !== "cancelled");
      const blockers = activeBookings.filter(
        (b) =>
          b.car_id === conflictModal.requestedCarId &&
          overlaps(b.start_date, b.end_date, conflictModal.requestedStart, conflictModal.requestedEnd),
      );
      setConflictModal((prev) => (prev ? { ...prev, bookings: activeBookings, blockers } : prev));
    } catch {
      // Keep current modal data if refresh failed.
    }
  }, [bookingsAPI, conflictModal]);

  const hasTargetOverlap = useCallback(
    (targetCarId, movingStart, movingEnd, excludeBookingId = null) => {
      if (!conflictModal) return true;
      return conflictModal.bookings.some(
        (b) =>
          b.car_id === targetCarId &&
          b.status !== "cancelled" &&
          b.id !== excludeBookingId &&
          overlaps(b.start_date, b.end_date, movingStart, movingEnd),
      );
    },
    [conflictModal],
  );

  const resolveByMovingExisting = useCallback(
    async (bookingId, toCarId) => {
      const existing = conflictModal?.bookings.find((b) => b.id === bookingId);
      if (!existing) return;

      if (hasTargetOverlap(toCarId, existing.start_date, existing.end_date, existing.id)) {
        setFormError("לא ניתן להעביר את ההזמנה לרכב הזה בגלל חפיפה עם הזמנה אחרת.");
        return;
      }

      const targetCar = (cars || []).find((c) => c.id === toCarId);
      const sourceCar = (cars || []).find((c) => c.id === existing.car_id);
      const sourceLabel = `${sourceCar?.name || `#${existing.car_id}`} (#${existing.car_id}${sourceCar?.plate ? ` · ${sourceCar.plate}` : ""})`;
      const targetLabel = `${targetCar?.name || `#${toCarId}`} (#${toCarId}${targetCar?.plate ? ` · ${targetCar.plate}` : ""})`;

      const ok = await askActionConfirm({
        message: `להעביר את הזמנה #${existing.id} (${existing.customer_name})?\nלאחר ההעברה תתבצע בדיקה אם אפשר לאשר את ההזמנה החדשה.`,
        messageList: [`${sourceLabel} ← ${targetLabel}`],
        confirmLabel: "העבר הזמנה",
        confirmColor: "#2563eb",
      });
      if (!ok) return;

      setResolvingConflict(true);
      try {
        await bookingsAPI.update(existing.id, { car_id: toCarId });
        const calendar = await bookingsAPI.calendar(conflictModal.viewStart, conflictModal.viewEnd);
        const activeBookings = (calendar || []).filter((b) => b.status !== "cancelled");
        const blockers = activeBookings.filter(
          (b) =>
            b.car_id === conflictModal.requestedCarId &&
            overlaps(b.start_date, b.end_date, conflictModal.requestedStart, conflictModal.requestedEnd),
        );

        if (blockers.length === 0) {
          await bookingsAPI.create(buildBookingPayload(form, conflictModal.requestedCarId, { mode: "create" }));
          await load();
          setConflictModal(null);
          setModal(null);
          toast.success("בוצע: ההזמנה הועברה וההזמנה החדשה אושרה.");
        } else {
          setConflictModal((prev) => (prev ? { ...prev, bookings: activeBookings, blockers } : prev));
          toast.success(`הזמנה #${existing.id} הועברה. עדיין יש ${blockers.length} התנגשות/ות לפתרון.`);
        }
      } catch (e) {
        if (e.status === 409) {
          await refreshConflictModal();
          setFormError("עדיין קיימת התנגשות. גרור שוב לרכב פנוי.");
        } else {
          setFormError(getUserFacingErrorMessage(e));
        }
      } finally {
        setResolvingConflict(false);
        setDragItem(null);
        setDragOverCarId(null);
      }
    },
    [
      askActionConfirm,
      bookingsAPI,
      cars,
      conflictModal,
      form,
      hasTargetOverlap,
      load,
      refreshConflictModal,
      setFormError,
      setModal,
    ],
  );

  const resolveByMovingNew = useCallback(
    async (toCarId) => {
      if (!conflictModal) return;

      if (hasTargetOverlap(toCarId, form.start_date, form.end_date, null)) {
        setFormError("לא ניתן להעביר את ההזמנה החדשה לרכב הזה בגלל חפיפה עם הזמנה אחרת.");
        return;
      }

      const targetCar = (cars || []).find((c) => c.id === toCarId);
      const ok = await askActionConfirm({
        message: `הרכב המבוקש תפוס. ליצור את ההזמנה החדשה על ${targetCar?.name || toCarId} במקום הרכב המקורי?`,
        confirmLabel: "צור על רכב חלופי",
        confirmColor: "#2563eb",
      });
      if (!ok) return;

      setResolvingConflict(true);
      try {
        await bookingsAPI.create(buildBookingPayload(form, toCarId, { mode: "create" }));
        await load();
        setConflictModal(null);
        setModal(null);
        toast.success(`ההזמנה החדשה נוצרה על ${targetCar?.name || toCarId}`);
      } catch (e) {
        if (e.status === 409) {
          await refreshConflictModal();
          setFormError("גם הרכב הזה תפוס כרגע. נסה לגרור לרכב אחר.");
        } else {
          setFormError(getUserFacingErrorMessage(e));
        }
      } finally {
        setResolvingConflict(false);
        setDragItem(null);
        setDragOverCarId(null);
      }
    },
    [askActionConfirm, bookingsAPI, cars, conflictModal, form, hasTargetOverlap, load, refreshConflictModal, setFormError, setModal],
  );

  const onConflictCardDragStart = useCallback((e, payload) => {
    if (e && e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "drag");
    }
    setDragItem(payload);
    setDragOverCarId(null);
  }, []);

  const onConflictCardDragEnd = useCallback(() => {
    setDragItem(null);
    setDragOverCarId(null);
  }, []);

  const onDropToCar = useCallback(
    async (targetCarId) => {
      if (!dragItem || resolvingConflict) return;
      setDragOverCarId(null);

      if (dragItem.type === "existing") {
        if (dragItem.booking.car_id === targetCarId) return;
        await resolveByMovingExisting(dragItem.booking.id, targetCarId);
        return;
      }

      if (dragItem.type === "new") {
        if (targetCarId === conflictModal?.requestedCarId) return;
        await resolveByMovingNew(targetCarId);
      }
    },
    [conflictModal?.requestedCarId, dragItem, resolveByMovingExisting, resolveByMovingNew, resolvingConflict],
  );

  const updateConflictFilters = useCallback(
    async (nextPatch) => {
      if (!conflictModal) return;
      const next = { ...conflictModal, ...nextPatch };
      const safeRange = ensureMinWeek(next.viewStart, next.viewEnd);
      next.viewStart = safeRange.startIso;
      next.viewEnd = safeRange.endIso;
      setConflictModal(next);

      try {
        const calendar = await bookingsAPI.calendar(next.viewStart, next.viewEnd);
        const activeBookings = (calendar || []).filter((b) => b.status !== "cancelled");
        const blockers = activeBookings.filter(
          (b) => b.car_id === next.requestedCarId && overlaps(b.start_date, b.end_date, next.requestedStart, next.requestedEnd),
        );
        setConflictModal((prev) => (prev ? { ...prev, ...next, bookings: activeBookings, blockers } : prev));
      } catch (e) {
        setFormError(getUserFacingErrorMessage(e));
      }
    },
    [bookingsAPI, conflictModal, setFormError],
  );

  return {
    conflictModal,
    setConflictModal,
    clearConflict,
    closeConflictModal,
    resolvingConflict,
    dragItem,
    dragOverCarId,
    setDragOverCarId,
    openConflictResolver,
    updateConflictFilters,
    onConflictCardDragStart,
    onConflictCardDragEnd,
    onDropToCar,
  };
}

