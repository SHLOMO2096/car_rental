import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { bookingsAPI } from "../../api/bookings";
import { carsAPI } from "../../api/cars";
import { customersAPI } from "../../api/customers";
import { settingsAPI } from "../../api/settings";
import { getUserFacingErrorMessage } from "../../api/errors";
import { Permissions } from "../../permissions";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAuthStore } from "../../store/auth";
import { toast } from "../../store/toast";
import Confirm from "../../components/ui/Confirm";
import { CameraCaptureModal, ImageGallery } from "../../components/photos/PhotoManagement";
import { getJewishDayMeta, isAfterClosureTime } from "../../utils/jewishCalendar";

import { ensureMinWeek, formatDate } from "./utils/dates";
import { isValidEmail } from "./utils/validation";
import { overlaps } from "./utils/bookingMath";
import { buildBookingPayload, makeEmptyForm } from "./utils/form";

import BookingsHeader from "./components/BookingsHeader";
import DateFilterBar from "./components/DateFilterBar";
import Pagination from "./components/Pagination";
import BookingsList from "./components/BookingsList";
import BookingFormModal from "./components/BookingFormModal";
import ConflictResolverModal from "./components/ConflictResolverModal";
import UploadQueueFloatingPanel from "./components/UploadQueueFloatingPanel";
import { useActionConfirm } from "./hooks/useActionConfirm";
import { usePhotoUploadQueue } from "./hooks/usePhotoUploadQueue";
import { useBookingsFiltering } from "./hooks/useBookingsFiltering";
import { useBookingsNavigationEffects } from "./hooks/useBookingsNavigationEffects";
import { useCustomerAutocomplete } from "./hooks/useCustomerAutocomplete";
import { useBookingPricePreview } from "./hooks/useBookingPricePreview";
import { useBookingQuickActions } from "./hooks/useBookingQuickActions";
import { useBookingsData } from "./hooks/useBookingsData";

export default function BookingsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatus] = useState("all");

  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [editBooking, setEdit] = useState(null);

  const { bookings, cars, loading, generalSettings, categories, load } = useBookingsData({
    bookingsAPI,
    carsAPI,
    settingsAPI,
  });

  const [form, setForm] = useState(() => makeEmptyForm({}));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [confirm, setConfirm] = useState(null);
  const { actionConfirm, askActionConfirm, closeActionConfirm } = useActionConfirm();

  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | 'tomorrow' | 'custom'
  const [customDate, setCustomDate] = useState("");

  const [activePhotoMenu, setActivePhotoMenu] = useState(null);

  const { uploadQueue, uploadPhotos, clearUploadQueue } = usePhotoUploadQueue({
    uploadPhoto: bookingsAPI.uploadPhoto,
  });

  const PER_PAGE = 15;
  const canDeleteBookings = useAuthStore((s) => s.can(Permissions.BOOKINGS_DELETE));

  // Conflict resolver
  const [conflictModal, setConflictModal] = useState(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [dragOverCarId, setDragOverCarId] = useState(null);

  // Customer autocomplete
  const { customerMatches, customersLoading, clearCustomerMatches } = useCustomerAutocomplete({
    modal,
    customerId: form.customer_id,
    customerName: form.customer_name,
    // Keep signature compatible with existing API call (q, limit)
    searchCustomers: (q, lim) => customersAPI.search(q, lim),
    limit: 8,
    debounceMs: 180,
    minChars: 2,
  });

  // Photos
  const [viewPhotos, setViewPhotos] = useState(null);
  const [cameraCapture, setCameraCapture] = useState(null);

  const isMobile = useIsMobile(900);


  useBookingsNavigationEffects({
    location,
    navigate,
    bookings,
    generalSettings,
    setForm,
    setEdit,
    setFormError,
    setModal,
    openEdit,
  });


  const { carsMap, activeDateStr, filtered, paginated, totalPages } = useBookingsFiltering({
    bookings,
    cars,
    search,
    statusFilter,
    dateFilter,
    customDate,
    page,
    perPage: PER_PAGE,
  });

  function openCreate() {
    setForm(makeEmptyForm(generalSettings || {}));
    setEdit(null);
    setFormError("");
    setModal("create");
    setConflictModal(null);
    clearCustomerMatches();
  }

  function openEdit(b) {
    setForm({
      ...makeEmptyForm(generalSettings || {}),
      customer_id: b.customer_id ? String(b.customer_id) : "",
      car_id: String(b.car_id),
      customer_name: b.customer_name,
      customer_email: b.customer_email || "",
      customer_phone: b.customer_phone || "",
      customer_has_no_email: !b.customer_email,
      customer_id_num: b.customer_id_num || "",
      start_date: b.start_date,
      end_date: b.end_date,
      notes: b.notes || "",
      start_time: b.pickup_time || generalSettings?.default_pickup_time || "08:00",
      end_time: b.return_time || generalSettings?.default_return_time || "08:00",
    });
    setEdit(b);
    setFormError("");
    setModal("edit");
    setConflictModal(null);
    clearCustomerMatches();
  }

  async function openConflictResolver() {
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
      const requestedCar = cars.find((c) => c.id === requestedCarId);
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
  }

  async function refreshConflictModal() {
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
  }

  function hasTargetOverlap(targetCarId, movingStart, movingEnd, excludeBookingId = null) {
    if (!conflictModal) return true;
    return conflictModal.bookings.some(
      (b) =>
        b.car_id === targetCarId &&
        b.status !== "cancelled" &&
        b.id !== excludeBookingId &&
        overlaps(b.start_date, b.end_date, movingStart, movingEnd),
    );
  }

  async function resolveByMovingExisting(bookingId, toCarId) {
    const existing = conflictModal?.bookings.find((b) => b.id === bookingId);
    if (!existing) return;

    if (hasTargetOverlap(toCarId, existing.start_date, existing.end_date, existing.id)) {
      setFormError("לא ניתן להעביר את ההזמנה לרכב הזה בגלל חפיפה עם הזמנה אחרת.");
      return;
    }

    const targetCar = cars.find((c) => c.id === toCarId);
    const sourceCar = cars.find((c) => c.id === existing.car_id);
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
  }

  async function resolveByMovingNew(toCarId) {
    if (!conflictModal) return;

    if (hasTargetOverlap(toCarId, form.start_date, form.end_date, null)) {
      setFormError("לא ניתן להעביר את ההזמנה החדשה לרכב הזה בגלל חפיפה עם הזמנה אחרת.");
      return;
    }

    const targetCar = cars.find((c) => c.id === toCarId);
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
  }

  function onConflictCardDragStart(e, payload) {
    if (e && e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "drag");
    }
    setDragItem(payload);
    setDragOverCarId(null);
  }

  function onConflictCardDragEnd() {
    setDragItem(null);
    setDragOverCarId(null);
  }

  async function onDropToCar(targetCarId) {
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
  }

  async function updateConflictFilters(nextPatch) {
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
  }

  async function handleSave() {
    if (!form.car_id) return setFormError("יש לבחור רכב");
    if (!form.customer_name.trim()) return setFormError("יש להזין שם לקוח");

    if (!form.customer_has_no_email && !form.customer_email.trim()) {
      return setFormError("יש להזין כתובת מייל תקינה או לסמן שאין מייל ללקוח");
    }

    if (!form.customer_has_no_email && form.customer_email.trim() && !isValidEmail(form.customer_email)) {
      return setFormError("כתובת המייל אינה תקינה");
    }

    if (!form.start_date) return setFormError("יש לבחור תאריך התחלה");
    if (!form.end_date) return setFormError("יש לבחור תאריך סיום");
    if (form.end_date < form.start_date) return setFormError("תאריך סיום לפני תחילה");

    if (modal === "create") {
      const startMeta = getJewishDayMeta(form.start_date);
      const endMeta = getJewishDayMeta(form.end_date);
      const warnings = [];
      const closureTime = generalSettings?.closure_time || "12:00";

      if (startMeta.closureAtNoon && isAfterClosureTime(form.start_time || "08:00", closureTime)) {
        warnings.push(
          `איסוף אחרי ${closureTime} בתאריך ${formatDate(form.start_date)} (${startMeta.isShabbat ? "שבת" : "ערב חג"})`,
        );
      }
      if (endMeta.closureAtNoon && isAfterClosureTime(form.end_time || "08:00", closureTime)) {
        warnings.push(
          `החזרה אחרי ${closureTime} בתאריך ${formatDate(form.end_date)} (${endMeta.isShabbat ? "שבת" : "ערב חג"})`,
        );
      }

      if (warnings.length > 0) {
        const ok = await askActionConfirm({
          message: "בשבת ובערב חג העסק נסגר ב-12:00.\nנמצאו החריגות הבאות:",
          messageList: warnings,
          confirmLabel: "המשך שמירה",
          confirmColor: "#d97706",
        });
        if (!ok) return;
      }
    }

    setSaving(true);
    setFormError("");
    try {
      const data = buildBookingPayload(form, +form.car_id, { mode: modal });
      if (modal === "create") await bookingsAPI.create(data);
      else await bookingsAPI.update(editBooking.id, data);
      await load();
      setModal(null);
      toast.success(modal === "create" ? "ההזמנה נוצרה בהצלחה" : "ההזמנה עודכנה בהצלחה");
    } catch (e) {
      if (e.status === 409 && modal === "create") {
        await openConflictResolver();
      } else {
        setFormError(getUserFacingErrorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(b) {
    try {
      await bookingsAPI.delete(b.id);
      await load();
      toast.success("ההזמנה נמחקה בהצלחה");
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setConfirm(null);
    }
  }

  const { handleQuickComplete, handleQuickExtend, isBookingOverdue } = useBookingQuickActions({
    bookingsAPI,
    load,
    search,
  });

  function pickCustomer(customer) {
    setForm((f) => ({
      ...f,
      customer_id: String(customer.id),
      customer_name: customer.name || "",
      customer_email: customer.email || "",
      customer_has_no_email: !customer.email,
      customer_phone: customer.phone || "",
      customer_id_num: customer.id_number || "",
    }));
    clearCustomerMatches();
  }

  function openCustomerFromBooking(booking) {
    if (booking?.status !== "active" || !booking?.customer_id) return;
    navigate("/customers", {
      state: {
        highlightCustomerId: booking.customer_id,
        customerSearchPrefill: booking.customer_name || "",
      },
    });
  }

  const pricePreview = useBookingPricePreview({
    form,
    carsMap,
    categories,
    generalSettings,
  });

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>טוען...</div>;

  return (
    <div dir="rtl">
      <BookingsHeader
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusChange={(val) => {
          setStatus(val);
          setPage(1);
        }}
        onOpenCreate={openCreate}
        isMobile={isMobile}
      />

      <DateFilterBar
        dateFilter={dateFilter}
        onDateFilterChange={(key) => {
          setDateFilter(key);
          setPage(1);
        }}
        customDate={customDate}
        onCustomDateChange={(val) => {
          setCustomDate(val);
          setPage(1);
        }}
        activeDateStr={activeDateStr}
        isMobile={isMobile}
      />

      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>{filtered.length} הזמנות נמצאו</div>

      <BookingsList
        bookings={paginated}
        carsMap={carsMap}
        isMobile={isMobile}
        canDeleteBookings={canDeleteBookings}
        activePhotoMenu={activePhotoMenu}
        onTogglePhotoMenu={setActivePhotoMenu}
        onOpenEdit={openEdit}
        onOpenCustomerFromBooking={openCustomerFromBooking}
        onRequestDelete={(b) => setConfirm({ action: "delete", item: b })}
        onViewPhotos={setViewPhotos}
        onUploadPhotos={uploadPhotos}
        onContinuousCamera={(bookingId) => setCameraCapture(bookingId)}
        isBookingOverdue={isBookingOverdue}
        onQuickComplete={handleQuickComplete}
        onQuickExtend={handleQuickExtend}
      />

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <BookingFormModal
        open={!!modal}
        mode={modal}
        form={form}
        setForm={setForm}
        cars={cars}
        categories={categories}
        customersLoading={customersLoading}
        customerMatches={customerMatches}
        onPickCustomer={pickCustomer}
        isMobile={isMobile}
        saving={saving}
        formError={formError}
        editBooking={editBooking}
        onClose={() => {
          setModal(null);
          setConflictModal(null);
          clearCustomerMatches();
        }}
        onSave={handleSave}
        preview={{
          show: pricePreview.show,
          days: pricePreview.days,
          pricePerDay: pricePreview.pricePerDay,
          total: pricePreview.total,
        }}
      />

      <ConflictResolverModal
        open={!!conflictModal}
        conflictModal={conflictModal}
        categories={categories}
        cars={cars}
        form={form}
        isMobile={isMobile}
        resolvingConflict={resolvingConflict}
        dragItem={dragItem}
        dragOverCarId={dragOverCarId}
        setDragOverCarId={setDragOverCarId}
        onClose={() => {
          if (resolvingConflict) return;
          setConflictModal(null);
          setDragItem(null);
          setDragOverCarId(null);
        }}
        onUpdateFilters={updateConflictFilters}
        onCardDragStart={onConflictCardDragStart}
        onCardDragEnd={onConflictCardDragEnd}
        onDropToCar={onDropToCar}
      />

      <Confirm
        open={confirm?.action === "delete"}
        message={`למחוק לצמיתות את הזמנה #${confirm?.item?.id}?`}
        confirmLabel="מחק"
        confirmColor="#dc2626"
        onConfirm={() => handleDelete(confirm.item)}
        onCancel={() => setConfirm(null)}
      />

      <Confirm
        open={!!actionConfirm}
        message={actionConfirm?.message || ""}
        messageList={actionConfirm?.messageList || null}
        confirmLabel={actionConfirm?.confirmLabel || "אישור"}
        confirmColor={actionConfirm?.confirmColor || "#1d4ed8"}
        onConfirm={() => closeActionConfirm(true)}
        onCancel={() => closeActionConfirm(false)}
      />

      {viewPhotos && <ImageGallery photos={viewPhotos.drive_link} onClose={() => setViewPhotos(null)} />}

      {cameraCapture && (
        <CameraCaptureModal
          bookingId={cameraCapture}
          onClose={() => setCameraCapture(null)}
          onCapture={(file) => uploadPhotos(cameraCapture, [file])}
        />
      )}

      <UploadQueueFloatingPanel uploadQueue={uploadQueue} onClear={clearUploadQueue} />
    </div>
  );
}

