import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserFacingErrorMessage } from "../api/errors";
import { bookingsAPI } from "../api/bookings";
import { carsAPI } from "../api/cars";
import { customersAPI } from "../api/customers";
import { settingsAPI } from "../api/settings";
import { useAuthStore } from "../store/auth";
import { toast } from "../store/toast";
import { Permissions } from "../permissions";
import Modal from "../components/ui/Modal";
import Badge from "../components/ui/Badge";
import Confirm from "../components/ui/Confirm";
import { useIsMobile } from "../hooks/useIsMobile";
import { getJewishDayMeta, isAfterClosureTime } from "../utils/jewishCalendar";

const STATUS_OPTIONS = [
  { value: "active", label: "פעיל", color: "green" },
  { value: "completed", label: "הושלם", color: "blue" },
  { value: "cancelled", label: "בוטל", color: "gray" },
];
const statusMap = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return toLocalISODate(d);
}
function toLocalISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function addDays(baseIso, days) {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}
function todayISO() { return toLocalISODate(new Date()); }
function diffDays(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso);
  return Math.round(ms / 86400000);
}
function ensureMinWeek(startIso, endIso) {
  if (!startIso || !endIso) return { startIso, endIso };
  const minEnd = addDays(startIso, 6);
  return { startIso, endIso: endIso < minEnd ? minEnd : endIso };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function makeEmptyForm(defaults = {}) {
  return {
    customer_id: "",
    car_id: "", customer_name: "", customer_email: "",
    customer_has_no_email: false,
    customer_phone: "", customer_id_num: "",
    start_date: todayISO(), start_time: defaults.default_pickup_time || "08:00",
    end_date: tomorrowISO(), end_time: defaults.default_return_time || "08:00",
    notes: "",
  };
}

export default function Bookings() {
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [modal, setModal] = useState(null);
  const [editBooking, setEdit] = useState(null);
  const [generalSettings, setGeneralSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(() => makeEmptyForm({}));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [actionConfirm, setActionConfirm] = useState(null);
  const actionConfirmResolveRef = useRef(null);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("all"); // "all" | "today" | "tomorrow" | "custom"
  const [customDate, setCustomDate] = useState("");
  const [uploadQueue, setUploadQueue] = useState([]); // Array of { id, bookingId, status: 'pending'|'compressing'|'uploading'|'done'|'error' }
  const [activePhotoMenu, setActivePhotoMenu] = useState(null); // bookingId
  const PER_PAGE = 15;
  const canDeleteBookings = useAuthStore(s => s.can(Permissions.BOOKINGS_DELETE));
  const [conflictModal, setConflictModal] = useState(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [dragOverCarId, setDragOverCarId] = useState(null);
  const [customerMatches, setCustomerMatches] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const isMobile = useIsMobile(900);
  const [viewPhotos, setViewPhotos] = useState(null);

  function askActionConfirm({ message, messageList = null, confirmLabel = "אישור", confirmColor = "#1d4ed8" }) {
    return new Promise((resolve) => {
      actionConfirmResolveRef.current = resolve;
      setActionConfirm({ message, messageList, confirmLabel, confirmColor });
    });
  }

  function closeActionConfirm(result) {
    if (actionConfirmResolveRef.current) {
      actionConfirmResolveRef.current(result);
      actionConfirmResolveRef.current = null;
    }
    setActionConfirm(null);
  }

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
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const prefill = location.state?.bookingPrefill;
    if (!prefill) return;

    setForm({
      ...makeEmptyForm(generalSettings || {}),
      car_id: prefill.car_id || "",
      customer_id: prefill.customer_id ? String(prefill.customer_id) : "",
      customer_name: prefill.customer_name || "",
      customer_email: prefill.customer_email || "",
      customer_has_no_email: !prefill.customer_email,
      customer_phone: prefill.customer_phone || "",
      customer_id_num: prefill.customer_id_num || "",
      start_date: prefill.start_date || todayISO(),
      end_date: prefill.end_date || tomorrowISO(),
    });
    setEdit(null);
    setFormError("");
    setModal("create");
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const editId = location.state?.bookingEditId;
    if (!editId) return;
    const target = bookings.find((b) => b.id === Number(editId));
    if (!target) return;
    openEdit(target);
    navigate(location.pathname, { replace: true, state: {} });
  }, [bookings, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (modal !== "create" || form.customer_id) return;
    const q = form.customer_name.trim();
    if (q.length < 2) {
      setCustomerMatches([]);
      return;
    }
    const id = setTimeout(async () => {
      setCustomersLoading(true);
      try {
        const rows = await customersAPI.search(q, 8);
        setCustomerMatches(rows || []);
      } catch {
        setCustomerMatches([]);
      } finally {
        setCustomersLoading(false);
      }
    }, 180);
    return () => clearTimeout(id);
  }, [form.customer_name, modal]);

  const carsMap = Object.fromEntries(cars.map(c => [c.id, c]));

  // Resolve the active date filter to a date string (or null)
  const activeDateStr =
    dateFilter === "today" ? todayISO() :
      dateFilter === "tomorrow" ? tomorrowISO() :
        dateFilter === "custom" ? customDate :
          null;

  const filtered = bookings.filter(b => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (activeDateStr) {
      // Show bookings that are active on the selected date
      if (b.start_date > activeDateStr || b.end_date < activeDateStr) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const car = carsMap[b.car_id];
      if (!b.customer_name.toLowerCase().includes(q) &&
        !(b.customer_phone || "").includes(q) &&
        !(car?.name || "").toLowerCase().includes(q) &&
        !(b.customer_id_num || "").includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function openCreate() {
    setForm(makeEmptyForm(generalSettings || {})); setEdit(null); setFormError(""); setModal("create");
    setConflictModal(null);
    setCustomerMatches([]);
  }
  function openEdit(b) {
    setForm({
      ...makeEmptyForm(generalSettings || {}),
      customer_id: b.customer_id ? String(b.customer_id) : "",
      car_id: String(b.car_id), customer_name: b.customer_name,
      customer_email: b.customer_email || "", customer_phone: b.customer_phone || "",
      customer_has_no_email: !b.customer_email,
      customer_id_num: b.customer_id_num || "", start_date: b.start_date,
      end_date: b.end_date, notes: b.notes || "",
      start_time: b.pickup_time || generalSettings?.default_pickup_time || "08:00",
      end_time: b.return_time || generalSettings?.default_return_time || "08:00",
    });
    setEdit(b); setFormError(""); setModal("edit");
    setConflictModal(null);
    setCustomerMatches([]);
  }

  function buildBookingPayload(form, carId) {
    return {
      car_id: carId,
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      customer_name: form.customer_name.trim() || null,
      customer_email: form.customer_email.trim() || null,
      ...(modal === "create" ? { customer_has_no_email: !!form.customer_has_no_email } : {}),
      customer_phone: form.customer_phone.trim() || null,
      customer_id_num: form.customer_id_num.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      pickup_time: form.start_time || null,
      return_time: form.end_time || null,
      notes: form.notes.trim() || null,
    };
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return !(aEnd < bStart || aStart > bEnd);
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
        (b) => b.car_id === requestedCarId && overlaps(b.start_date, b.end_date, requestedStart, requestedEnd)
      );
      const requestedCar = cars.find((c) => c.id === requestedCarId);
      setConflictModal({
        requestedCarId,
        requestedCarName: requestedCar ? `${requestedCar.name} (#${requestedCar.id}${requestedCar.plate ? ` · ${requestedCar.plate}` : ""})` : `#${requestedCarId}`,
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
        (b) => b.car_id === conflictModal.requestedCarId &&
          overlaps(b.start_date, b.end_date, conflictModal.requestedStart, conflictModal.requestedEnd)
      );
      setConflictModal((prev) => prev ? { ...prev, bookings: activeBookings, blockers } : prev);
    } catch {
      // Keep current modal data if refresh failed.
    }
  }

  function hasTargetOverlap(targetCarId, movingStart, movingEnd, excludeBookingId = null) {
    if (!conflictModal) return true;
    return conflictModal.bookings.some((b) => (
      b.car_id === targetCarId &&
      b.status !== "cancelled" &&
      b.id !== excludeBookingId &&
      overlaps(b.start_date, b.end_date, movingStart, movingEnd)
    ));
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
        (b) => b.car_id === conflictModal.requestedCarId &&
          overlaps(b.start_date, b.end_date, conflictModal.requestedStart, conflictModal.requestedEnd)
      );

      if (blockers.length === 0) {
        await bookingsAPI.create(buildBookingPayload(form, conflictModal.requestedCarId));
        await load();
        setConflictModal(null);
        setModal(null);
        toast.success("בוצע: ההזמנה הועברה וההזמנה החדשה אושרה.");
      } else {
        setConflictModal((prev) => prev ? { ...prev, bookings: activeBookings, blockers } : prev);
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
      await bookingsAPI.create(buildBookingPayload(form, toCarId));
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
        (b) => b.car_id === next.requestedCarId && overlaps(b.start_date, b.end_date, next.requestedStart, next.requestedEnd)
      );
      setConflictModal((prev) => prev ? { ...prev, ...next, bookings: activeBookings, blockers } : prev);
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
        warnings.push(`איסוף אחרי ${closureTime} בתאריך ${formatDate(form.start_date)} (${startMeta.isShabbat ? "שבת" : "ערב חג"})`);
      }
      if (endMeta.closureAtNoon && isAfterClosureTime(form.end_time || "08:00", closureTime)) {
        warnings.push(`החזרה אחרי ${closureTime} בתאריך ${formatDate(form.end_date)} (${endMeta.isShabbat ? "שבת" : "ערב חג"})`);
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

    setSaving(true); setFormError("");
    try {
      const data = buildBookingPayload(form, +form.car_id);
      if (modal === "create") await bookingsAPI.create(data);
      else await bookingsAPI.update(editBooking.id, data);
      await load(); setModal(null);
      toast.success(modal === "create" ? "ההזמנה נוצרה בהצלחה" : "ההזמנה עודכנה בהצלחה");
    } catch (e) {
      if (e.status === 409 && modal === "create") {
        await openConflictResolver();
      } else {
        setFormError(getUserFacingErrorMessage(e));
      }
    } finally { setSaving(false); }
  }

  async function handleCancel(b) {
    try {
      await bookingsAPI.update(b.id, { status: "cancelled" });
      await load();
      toast.success("ההזמנה בוטלה בהצלחה");
    }
    catch (e) { toast.error(getUserFacingErrorMessage(e)); }
    finally { setConfirm(null); }
  }

  async function handleDelete(b) {
    try {
      await bookingsAPI.delete(b.id);
      await load();
      toast.success("ההזמנה נמחקה בהצלחה");
    }
    catch (e) { toast.error(getUserFacingErrorMessage(e)); }
    finally { setConfirm(null); }
  }

  async function compressImage(file, maxDimension = 2048, quality = 0.9) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
            else resolve(file);
          }, "image/jpeg", quality);
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoUpload(bookingId, files) {
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files);
    
    // Add each file to the queue
    const newUploads = fileList.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      bookingId,
      fileName: file.name,
      status: "compressing"
    }));
    
    setUploadQueue(prev => [...prev, ...newUploads]);

    // Process each file in parallel
    fileList.forEach(async (file, index) => {
      const uploadId = newUploads[index].id;
      
      try {
        const compressed = await compressImage(file);
        
        setUploadQueue(prev => prev.map(u => u.id === uploadId ? { ...u, status: "uploading" } : u));
        
        await bookingsAPI.uploadPhoto(bookingId, compressed);
        
        setUploadQueue(prev => prev.map(u => u.id === uploadId ? { ...u, status: "done" } : u));
        
        // Remove from queue after 3 seconds if done
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(u => u.id !== uploadId));
        }, 3000);

        // Silent success, maybe just a small log or notification if first photo
        if (index === 0 && fileList.length === 1) {
           toast.success(`צילום הועלה בהצלחה להזמנה #${bookingId}`);
        }
      } catch (e) {
        setUploadQueue(prev => prev.map(u => u.id === uploadId ? { ...u, status: "error", error: getUserFacingErrorMessage(e) } : u));
        toast.error(`נכשל העלאת תמונה: ${getUserFacingErrorMessage(e)}`);
      }
    });
  }

  async function handleQuickComplete(b) {
    try {
      await bookingsAPI.update(b.id, { ...b, status: "completed" });
      toast.success("הזמנה סומנה כהושלמה");
      load(search.trim());
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    }
  }

  async function handleQuickExtend(b) {
    try {
      const newEnd = addDays(b.end_date, 1);
      await bookingsAPI.update(b.id, { ...b, end_date: newEnd });
      toast.success("הזמנה הוארכה ביום אחד");
      load(search.trim());
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    }
  }

  function isBookingOverdue(b) {
    if (b.status !== "active") return false;
    const endDateStr = b.end_date;
    const endTimeStr = b.return_time || "08:00";
    const endDateTime = new Date(`${endDateStr}T${endTimeStr}`);
    return endDateTime < new Date();
  }

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
    setCustomerMatches([]);
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

  // price preview
  const previewCar = form.car_id ? carsMap[+form.car_id] : null;
  const startDt = new Date(`${form.start_date}T${form.start_time || "00:00"}`);
  const endDt   = new Date(`${form.end_date}T${form.end_time || "00:00"}`);
  const diffMs  = endDt - startDt;
  const graceMs = (Number(generalSettings?.grace_period_hours) || 0) * 3600000;
  const days    = isNaN(diffMs) || diffMs <= 0 ? 0 : Math.ceil((diffMs - graceMs) / 86400000);

  let pricePerDay = previewCar?.price_per_day || 0;

  if (!pricePerDay && previewCar?.category) {
    const carCat = categories.find(c => c.name === previewCar.category);
    if (carCat) {
      pricePerDay = previewCar.is_hybrid ? (Number(carCat.hybrid_price) || Number(carCat.base_price)) : Number(carCat.base_price);
    }
  }
  const previewTotal = pricePerDay * days;

  const conflictModelOptions = conflictModal
    ? [...new Set(cars.filter((c) => c.is_active).map((c) => c.name))]
      .sort((a, b) => a.localeCompare(b, "he"))
    : [];

  const conflictVisibleCars = conflictModal
    ? cars.filter((c) => c.is_active && (
      (!conflictModal.modelFilter || conflictModal.modelFilter.length === 0 || conflictModal.modelFilter.includes(c.name)) &&
      (!conflictModal.categoryFilter || conflictModal.categoryFilter.length === 0 || conflictModal.categoryFilter.includes(c.category || ""))
    ))
    : [];

  const conflictDates = conflictModal
    ? Array.from(
      { length: Math.max(diffDays(conflictModal.viewStart, conflictModal.viewEnd) + 1, 1) },
      (_, i) => addDays(conflictModal.viewStart, i)
    )
    : [];

  const conflictOcc = {};
  if (conflictModal) {
    conflictModal.bookings.forEach((b) => {
      conflictDates.forEach((ds) => {
        if (ds >= b.start_date && ds <= b.end_date) conflictOcc[`${ds}:${b.car_id}`] = b;
      });
    });
  }

  const draggingRange = dragItem
    ? (dragItem.type === "existing"
      ? { start: dragItem.booking.start_date, end: dragItem.booking.end_date }
      : { start: form.start_date, end: form.end_date })
    : null;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>טוען...</div>;

  return (
    <div dir="rtl">
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.h1}>ניהול הזמנות</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
          <input placeholder="🔍 לקוח, טלפון, רכב..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ ...s.searchInput, minWidth: isMobile ? "100%" : 220 }} />
          <select value={statusFilter}
            onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ ...s.select, width: isMobile ? "100%" : "auto" }}>
            <option value="all">כל הסטטוסים</option>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={openCreate} style={{ ...s.btnPrimary, width: isMobile ? "100%" : "auto" }}>+ הזמנה חדשה</button>
        </div>
      </div>

      {/* Date filter bar */}
      <div style={{ ...s.dateFilterBar, overflowX: isMobile ? "auto" : "visible", flexWrap: isMobile ? "nowrap" : "wrap" }}>
        {[
          { key: "all", label: "כל התאריכים" },
          { key: "today", label: "היום" },
          { key: "tomorrow", label: "מחר" },
          { key: "custom", label: "תאריך ספציפי 📅" },
        ].map(opt => (
          <button key={opt.key}
            onClick={() => { setDateFilter(opt.key); setPage(1); }}
            style={dateFilter === opt.key ? s.dateFilterBtnActive : s.dateFilterBtn}>
            {opt.label}
          </button>
        ))}
        {dateFilter === "custom" && (
          <input type="date" value={customDate}
            onChange={e => { setCustomDate(e.target.value); setPage(1); }}
            style={s.datePickerInline} />
        )}
        {activeDateStr && dateFilter !== "all" && (
          <span style={s.dateFilterHint}>
            📋 מציג הזמנות פעילות ב-{new Date(activeDateStr).toLocaleDateString("he-IL")}
          </span>
        )}
      </div>

      {/* Counter */}
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
        {filtered.length} הזמנות נמצאו
      </div>

      {/* Table / Cards */}
      {!isMobile ? (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "לקוח", "רכב", "מתאריך", "עד תאריך", "סכום", "סטטוס", "פעולות"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(b => {
                const car = carsMap[b.car_id];
                const st = statusMap[b.status] || statusMap.cancelled;
                const overdue = isBookingOverdue(b);
                return (
                  <tr key={b.id} style={s.tr}>
                    <td style={s.td}><span style={s.idBadge}>#{b.id}</span></td>
                    <td style={s.td}>
                      {b.status === "active" && b.customer_id ? (
                        <button
                          type="button"
                          onClick={() => openCustomerFromBooking(b)}
                          style={s.customerLinkBtn}
                          title="פתח כרטיס לקוח"
                          aria-label={`פתח כרטיס לקוח: ${b.customer_name}`}
                        >
                          👤 {b.customer_name}
                        </button>
                      ) : (
                        <div style={{ fontWeight: 600 }}>{b.customer_name}</div>
                      )}
                      {b.customer_phone && <div style={s.sub}>{b.customer_phone}</div>}
                      {b.customer_email && <div style={s.sub}>{b.customer_email}</div>}
                    </td>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600 }}>{car?.name || "—"}</div>
                      {car && <div style={s.sub}>{car.plate}</div>}
                    </td>
                    <td style={s.td}>
                      <div>{formatDate(b.start_date)}</div>
                      {b.status === "active" && (
                        <div style={s.sub}>איסוף: {b.pickup_time || "08:00"}</div>
                      )}
                    </td>
                    <td style={s.td}>
                      <div style={{ color: overdue ? "#dc2626" : "inherit", fontWeight: overdue ? "bold" : "normal" }}>
                        {formatDate(b.end_date)}
                      </div>
                      {b.status === "active" && (
                        <div style={{ ...s.sub, color: overdue ? "#ef4444" : s.sub.color }}>החזרה: {b.return_time || "08:00"}</div>
                      )}
                      {overdue && (
                        <div style={{ fontSize: 10, color: "#dc2626", fontWeight: "bold", marginTop: 4 }}>
                          ⚠️ חלף זמן החזרה
                        </div>
                      )}
                    </td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 700, color: "#1d4ed8" }}>
                        {b.total_price ? `₪${b.total_price.toLocaleString()}` : "—"}
                      </span>
                    </td>
                    <td style={s.td}>
                      <Badge label={st.label} color={st.color} />
                      {b.email_sent && <span title="אימייל נשלח" style={{ marginRight: 4 }}>📧</span>}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {overdue && (
                          <>
                            <button onClick={() => handleQuickComplete(b)} style={{ ...s.btnIcon, color: "#166534", background: "#dcfce7", fontSize: 12, padding: "2px 6px", fontWeight: "bold" }} title="סמן כהושלמה">✅ סיום</button>
                            <button onClick={() => handleQuickExtend(b)} style={{ ...s.btnIcon, color: "#1d4ed8", background: "#dbeafe", fontSize: 12, padding: "2px 6px", fontWeight: "bold" }} title="הארך ביום אחד">📅 +יום</button>
                          </>
                        )}
                        <button onClick={() => openEdit(b)} style={s.btnIcon} title="ערוך">✏️</button>
                        {b.status === "active" && (
                          <PhotoMenu 
                            booking={b} 
                            onView={() => setViewPhotos(b)} 
                            onUpload={(files) => handlePhotoUpload(b.id, files)}
                            isOpen={activePhotoMenu === b.id}
                            onToggle={() => setActivePhotoMenu(activePhotoMenu === b.id ? null : b.id)}
                          />
                        )}
                        {canDeleteBookings && (
                          <button onClick={() => setConfirm({ action: "delete", item: b })}
                            style={s.btnIcon} title="מחק">🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                  לא נמצאו הזמנות
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={s.mobileCardsWrap}>
          {paginated.map((b) => {
            const car = carsMap[b.car_id];
            const st = statusMap[b.status] || statusMap.cancelled;
            const overdue = isBookingOverdue(b);
            return (
              <div key={b.id} style={s.mobileCard}>
                <div style={s.mobileCardHead}>
                  <span style={s.idBadge}>#{b.id}</span>
                  <Badge label={st.label} color={st.color} />
                </div>
                {b.status === "active" && b.customer_id ? (
                  <button
                    type="button"
                    onClick={() => openCustomerFromBooking(b)}
                    style={s.mobileCustomerLinkBtn}
                    title="פתח כרטיס לקוח"
                    aria-label={`פתח כרטיס לקוח: ${b.customer_name}`}
                  >
                    👤 {b.customer_name}
                  </button>
                ) : (
                  <div style={s.mobileTitle}>{b.customer_name}</div>
                )}
                <div style={s.sub}>{car?.name || "—"}{car?.plate ? ` · ${car.plate}` : ""}</div>
                <div style={s.mobileDates}>
                  <div>
                    <b>מתאריך:</b> {formatDate(b.start_date)}
                    {b.status === "active" && <div style={s.sub}>איסוף: {b.pickup_time || "08:00"}</div>}
                  </div>
                  <div>
                    <b style={{ color: overdue ? "#dc2626" : "inherit" }}>עד תאריך:</b>{" "}
                    <span style={{ color: overdue ? "#dc2626" : "inherit", fontWeight: overdue ? "bold" : "normal" }}>
                      {formatDate(b.end_date)}
                    </span>
                    {b.status === "active" && <div style={{ ...s.sub, color: overdue ? "#ef4444" : s.sub.color }}>החזרה: {b.return_time || "08:00"}</div>}
                    {overdue && (
                      <div style={{ fontSize: 10, color: "#dc2626", fontWeight: "bold", marginTop: 2 }}>
                        ⚠️ חלף זמן החזרה
                      </div>
                    )}
                  </div>
                </div>
                <div style={s.mobileFooter}>
                  <span style={{ fontWeight: 700, color: "#1d4ed8" }}>{b.total_price ? `₪${b.total_price.toLocaleString()}` : "—"}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {overdue && (
                      <>
                        <button onClick={() => handleQuickComplete(b)} style={{ ...s.btnIcon, color: "#166534", background: "#dcfce7", fontSize: 12, padding: "2px 6px", fontWeight: "bold" }} title="סמן כהושלמה">✅ סיום</button>
                        <button onClick={() => handleQuickExtend(b)} style={{ ...s.btnIcon, color: "#1d4ed8", background: "#dbeafe", fontSize: 12, padding: "2px 6px", fontWeight: "bold" }} title="הארך ביום אחד">📅 +יום</button>
                      </>
                    )}
                    <button onClick={() => openEdit(b)} style={s.btnIcon} title="ערוך">✏️</button>
                    {b.status === "active" && (
                      <PhotoMenu 
                        booking={b} 
                        onView={() => setViewPhotos(b)} 
                        onUpload={(files) => handlePhotoUpload(b.id, files)}
                        isOpen={activePhotoMenu === b.id}
                        onToggle={() => setActivePhotoMenu(activePhotoMenu === b.id ? null : b.id)}
                      />
                    )}
                    {canDeleteBookings && (
                      <button onClick={() => setConfirm({ action: "delete", item: b })} style={s.btnIcon} title="מחק">🗑️</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {paginated.length === 0 && <div style={s.mobileEmpty}>לא נמצאו הזמנות</div>}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{
              ...s.pageBtn, background: p === page ? "#1d4ed8" : "#f1f5f9",
              color: p === page ? "#fff" : "#475569",
            }}>{p}</button>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={!!modal} onClose={() => { setModal(null); setConflictModal(null); setCustomerMatches([]); }}
        title={modal === "create" ? "הזמנה חדשה" : "עריכת הזמנה"} wide>
        <div style={{ ...s.formGrid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={s.label}>רכב *</label>
            <select value={form.car_id} onChange={e => setForm(f => ({ ...f, car_id: e.target.value }))}
              style={s.input} disabled={modal === "edit"}>
              <option value="">— בחר רכב —</option>
              {([...categories, { name: "ללא קטגוריה" }]).map(cat => {
                const catCars = cars.filter(c => c.is_active && (c.category === cat.name || (!c.category && cat.name === "ללא קטגוריה")));
                if (catCars.length === 0) return null;
                
                return (
                  <optgroup key={cat.name} label={cat.name}>
                    {catCars.map(c => {
                      let effectivePrice = c.price_per_day;
                      if (!effectivePrice) {
                        const carCat = categories.find(cc => cc.name === c.category);
                        if (carCat) {
                          effectivePrice = c.is_hybrid ? (carCat.hybrid_price || carCat.base_price) : carCat.base_price;
                        }
                      }
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.plate}) {c.is_hybrid ? "🌿" : ""} — ₪{effectivePrice}/יום
                        </option>
                      );
                    })}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div>
            <label style={s.label}>שם לקוח *</label>
            <div style={{ position: "relative" }}>
              <input value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_id: "", customer_name: e.target.value, customer_id_num: "" }))}
                style={s.input}
                placeholder="הקלד לפחות 2 תווים לחיפוש לקוח" />
              {modal === "create" && form.customer_name.trim().length >= 2 && (
                <div style={s.customerDropdown}>
                  {customersLoading && <div style={s.customerItemMuted}>מחפש לקוחות...</div>}
                  {!customersLoading && customerMatches.length === 0 && (
                    <div style={s.customerItemMuted}>לא נמצא לקוח קיים, ייווצר לקוח חדש בשמירה</div>
                  )}
                  {!customersLoading && customerMatches.map((c) => (
                    <button key={c.id} type="button" style={s.customerItem} onClick={() => pickCustomer(c)}>
                      <span style={{ fontWeight: 700 }}>{c.name}</span>
                      <span style={s.customerMeta}>{[c.id_number, c.phone, c.email].filter(Boolean).join(" · ") || "ללא פרטי קשר"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label style={s.label}>אימייל (לאישור)</label>
            <input type="email" value={form.customer_email}
              onChange={e => setForm(f => ({ ...f, customer_email: e.target.value, customer_has_no_email: false }))}
              style={s.input}
              disabled={form.customer_has_no_email}
              placeholder={form.customer_has_no_email ? "סומן שאין מייל ללקוח" : "name@example.com"} />
            {modal === "create" && (
              <label style={s.checkboxRow}>
                <input
                  type="checkbox"
                  checked={!!form.customer_has_no_email}
                  onChange={e => setForm(f => ({
                    ...f,
                    customer_has_no_email: e.target.checked,
                    customer_email: e.target.checked ? "" : f.customer_email,
                  }))}
                />
                <span>אין מייל ללקוח</span>
              </label>
            )}
          </div>
          <div>
            <label style={s.label}>טלפון</label>
            <input value={form.customer_phone}
              onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} style={s.input} />
          </div>
          <div>
            <label style={s.label}>מספר זהות</label>
            <input value={form.customer_id_num}
              onChange={e => setForm(f => ({ ...f, customer_id_num: e.target.value }))} style={s.input} />
          </div>
          <div>
            <label style={s.label}>מתאריך * <span style={s.timeHint}>שעת איסוף</span></label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                style={{ ...s.input, flex: 2 }} />
              <input type="time" value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                style={{ ...s.input, flex: 1 }} />
            </div>
          </div>
          <div>
            <label style={s.label}>עד תאריך * <span style={s.timeHint}>שעת החזרה</span></label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="date" value={form.end_date} min={form.start_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                style={{ ...s.input, flex: 2 }} />
              <input type="time" value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                style={{ ...s.input, flex: 1 }} />
            </div>
            {/* Quick duration buttons */}
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {[
                { label: "שבוע", days: 7 },
                { label: "שבועיים", days: 14 },
                { label: "חודש", days: 30 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    if (!form.start_date) return;
                    setForm(f => ({ ...f, end_date: addDays(f.start_date, days) }));
                  }}
                  style={s.durationBtn}
                >
                  {label} ({days} יום)
                </button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={s.label}>הערות</label>
            <textarea value={form.notes} rows={2}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ ...s.input, resize: "vertical" }} />
          </div>
        </div>

        {/* Price preview */}
          <div style={s.pricePreview}>
            💰 {days} ימים × ₪{pricePerDay} = <strong>₪{previewTotal.toLocaleString()}</strong>
            {form.customer_email && <span style={{ marginRight: 12 }}>📧 אישור יישלח ללקוח</span>}
          </div>
        )}

        {formError && <div style={s.errorBox}>{formError}</div>}

        <div style={s.modalFooter}>
          <button onClick={() => { setModal(null); setConflictModal(null); setCustomerMatches([]); }} style={{ ...s.btnSecondary, width: isMobile ? "100%" : "auto" }}>ביטול</button>
          <button onClick={handleSave} disabled={saving} style={{ ...s.btnPrimary, width: isMobile ? "100%" : "auto" }}>
            {saving ? "שומר..." : modal === "create" ? "אשר הזמנה" : "שמור שינויים"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!conflictModal}
        onClose={() => {
          if (resolvingConflict) return;
          setConflictModal(null);
          setDragItem(null);
          setDragOverCarId(null);
        }}
        title="הרכב תפוס - פתרון בגרירה"
        wide
        maxWidth={960}
      >
        {conflictModal && (
          <div>
            <div style={s.conflictIntro}>
              <strong>⚠️ הרכב {conflictModal.requestedCarName} תפוס בין {formatDate(conflictModal.requestedStart)} ל-{formatDate(conflictModal.requestedEnd)}.</strong>
              <div style={{ marginTop: 6 }}>
                גרור כרטיסים בין רכבים כדי לפנות מקום:
                1) אפשר לגרור כל הזמנה קיימת בלוח.
                2) אפשר גם לגרור את ההזמנה החדשה לרכב חלופי.
              </div>
            </div>

            <div style={s.conflictFilters}>
              <label style={s.conflictFilterField}>
                <span style={s.conflictFilterLabel}>
                  קטגוריה
                  {conflictModal.categoryFilter.length > 0 && (
                    <button
                      onClick={() => updateConflictFilters({ categoryFilter: [] })}
                      disabled={resolvingConflict}
                      style={s.conflictClearBtn}
                    >נקה</button>
                  )}
                </span>
                <div style={s.conflictFilterScroll}>
                  {categories.map((cat) => {
                    const checked = conflictModal.categoryFilter.includes(cat.name);
                    return (
                      <label key={cat.name} style={{ ...s.conflictFilterItem, background: checked ? "#eff6ff" : "transparent" }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            const next = checked ? conflictModal.categoryFilter.filter(c => c !== cat.name) : [...conflictModal.categoryFilter, cat.name];
                            updateConflictFilters({ categoryFilter: next });
                          }}
                        />
                        {cat.name}
                      </label>
                    );
                  })}
                </div>
              </label>

              <label style={s.conflictFilterField}>
                <span style={s.conflictFilterLabel}>
                  דגם
                  {conflictModal.modelFilter.length > 0 && (
                    <button
                      onClick={() => updateConflictFilters({ modelFilter: [] })}
                      disabled={resolvingConflict}
                      style={{ marginRight: 6, fontSize: 10, padding: "1px 6px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer", color: "#64748b" }}
                    >נקה</button>
                  )}
                </span>
                <div style={{
                  border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff",
                  maxHeight: 130, overflowY: "auto", padding: "4px 0",
                  opacity: resolvingConflict ? 0.5 : 1,
                  pointerEvents: resolvingConflict ? "none" : "auto",
                }}>
                  {conflictModelOptions.map((model) => {
                    const checked = conflictModal.modelFilter.includes(model);
                    return (
                      <label key={model} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "3px 10px",
                        cursor: "pointer", fontSize: 12, color: "#374151",
                        background: checked ? "#eff6ff" : "transparent",
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = conflictModal.modelFilter;
                            const next = checked
                              ? current.filter((m) => m !== model)
                              : [...current, model];
                            updateConflictFilters({ modelFilter: next });
                          }}
                        />
                        {model}
                      </label>
                    );
                  })}
                  {conflictModelOptions.length === 0 && (
                    <div style={{ padding: "4px 10px", fontSize: 12, color: "#94a3b8" }}>אין דגמים</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {conflictModal.modelFilter.length === 0
                    ? "מוצגים כל הדגמים"
                    : `${conflictModal.modelFilter.length} דגמים נבחרו`}
                </div>
              </label>
              <label style={s.conflictFilterField}>
                <span style={s.conflictFilterLabel}>מתאריך</span>
                <input
                  type="date"
                  value={conflictModal.viewStart}
                  onChange={(e) => updateConflictFilters({ viewStart: e.target.value })}
                  style={s.conflictFilterInput}
                  disabled={resolvingConflict}
                />
              </label>
              <label style={s.conflictFilterField}>
                <span style={s.conflictFilterLabel}>עד תאריך (מינימום שבוע)</span>
                <input
                  type="date"
                  value={conflictModal.viewEnd}
                  min={addDays(conflictModal.viewStart, 6)}
                  onChange={(e) => updateConflictFilters({ viewEnd: e.target.value })}
                  style={s.conflictFilterInput}
                  disabled={resolvingConflict}
                />
              </label>
            </div>

            <div style={s.newBookingCardWrap}>
              <div
                draggable={!resolvingConflict}
                onDragStart={(e) => onConflictCardDragStart(e, { type: "new" })}
                onDragEnd={() => { setDragItem(null); setDragOverCarId(null); }}
                style={{ ...s.conflictCard, ...s.newBookingCard }}
              >
                <div style={s.newBookingBadge}>חדש · מוכן לגרירה</div>
                <div style={s.newBookingTitle}>✨ גרור אותי ללוח כדי לבחור רכב חלופי</div>
                <div style={s.newBookingMeta}>
                  {form.customer_name || "לקוח חדש"} · {formatDate(form.start_date)} עד {formatDate(form.end_date)}
                </div>
              </div>
              <div style={s.conflictLegend}>
                <span><b style={{ color: "#0f172a" }}>אפור:</b> הזמנה קיימת (ניתן לגרירה מהתאריך הראשון שלה)</span>
                <span><b style={{ color: "#991b1b" }}>אדום:</b> הזמנה שחוסמת כרגע את הרכב המבוקש</span>
                <span><b style={{ color: "#166534" }}>ירוק:</b> תא פנוי לשחרור</span>
                <span><b style={{ color: "#1d4ed8" }}>כחול:</b> טווח יעד פעיל לגרירה</span>
              </div>
            </div>

            <div style={s.conflictTableWrap}>
              <table style={{ ...s.conflictTable, minWidth: isMobile ? 620 : 780 }}>
                <thead>
                  <tr>
                    <th style={{ ...s.conflictTh, ...s.conflictStickyCorner }}>תאריך</th>
                    {conflictVisibleCars.map((car) => (
                      <th key={car.id} style={s.conflictTh}>
                        <div>{car.name} {car.id === conflictModal.requestedCarId ? "(מבוקש)" : ""}</div>
                        <div style={s.conflictCarMeta}>#{car.id}{car.plate ? ` · ${car.plate}` : ""}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {conflictDates.map((ds) => (
                    <tr key={ds}>
                      <td style={{ ...s.conflictTd, ...s.conflictStickyDate }}>{formatDayWithWeekday(ds)}</td>
                      {conflictVisibleCars.map((car) => {
                        const b = conflictOcc[`${ds}:${car.id}`];
                        const canDrop = dragItem && (
                          (dragItem.type === "new" && car.id !== conflictModal.requestedCarId) ||
                          (dragItem.type === "existing" && car.id !== dragItem.booking.car_id)
                        );
                        const isHoveredTarget = !!draggingRange && dragOverCarId === car.id;
                        const inPreviewRange = !!draggingRange && ds >= draggingRange.start && ds <= draggingRange.end;
                        const isRangePreviewCell = isHoveredTarget && inPreviewRange;
                        if (!b) {
                          return (
                            <td
                              key={car.id}
                              onDragOver={(e) => {
                                if (canDrop) {
                                  e.preventDefault();
                                  if (dragOverCarId !== car.id) setDragOverCarId(car.id);
                                }
                              }}
                              onDragLeave={() => { if (dragOverCarId === car.id) setDragOverCarId(null); }}
                              onDrop={(e) => { e.preventDefault(); onDropToCar(car.id); }}
                              style={{
                                ...s.conflictTd,
                                background: isRangePreviewCell ? "#bfdbfe" : (canDrop ? "#dbeafe" : "#dcfce7"),
                                color: canDrop ? "#1d4ed8" : "#166534",
                                cursor: canDrop ? "copy" : "default",
                                outline: isRangePreviewCell ? "1px dashed #2563eb" : "none",
                                outlineOffset: "-1px",
                              }}
                            >
                              {canDrop ? "שחרר כאן" : "פנוי"}
                            </td>
                          );
                        }

                        const isBlocker =
                          b.car_id === conflictModal.requestedCarId &&
                          overlaps(b.start_date, b.end_date, conflictModal.requestedStart, conflictModal.requestedEnd);
                        const dragAnchorDay = b.start_date > conflictModal.viewStart ? b.start_date : conflictModal.viewStart;
                        const isDragHandleCell = ds === dragAnchorDay;
                        const isExistingDragged = dragItem?.type === "existing" && dragItem.booking.id === b.id;
                        const oneDayBooking = b.start_date === b.end_date;
                        const pickup = b.pickup_time || "08:00";
                        const ret = b.return_time || "08:00";

                        return (
                          <td
                            key={car.id}
                            onDragOver={(e) => {
                              if (canDrop) {
                                e.preventDefault();
                                if (dragOverCarId !== car.id) setDragOverCarId(car.id);
                              }
                            }}
                            onDragLeave={() => { if (dragOverCarId === car.id) setDragOverCarId(null); }}
                            onDrop={(e) => { e.preventDefault(); onDropToCar(car.id); }}
                            style={{
                              ...s.conflictTd,
                              background: isRangePreviewCell ? "#bfdbfe" : (isBlocker ? "#fee2e2" : (isExistingDragged ? "#dbeafe" : "#f8fafc")),
                              color: isBlocker ? "#991b1b" : "#334155",
                              padding: 4,
                              outline: isRangePreviewCell ? "1px dashed #2563eb" : "none",
                              outlineOffset: "-1px",
                            }}
                          >
                            <div
                              draggable={isDragHandleCell && !resolvingConflict}
                              onDragStart={(e) => isDragHandleCell && onConflictCardDragStart(e, { type: "existing", booking: b })}
                              onDragEnd={() => { setDragItem(null); setDragOverCarId(null); }}
                              style={{
                                ...s.conflictCellCard,
                                opacity: isExistingDragged ? 0.62 : 1,
                                cursor: isDragHandleCell ? "grab" : "default",
                                borderColor: isBlocker ? "#fca5a5" : (isExistingDragged ? "#93c5fd" : "#cbd5e1"),
                                background: isBlocker ? "#fff1f2" : "#ffffff",
                              }}
                              title={isDragHandleCell ? "גרור להעברה לרכב אחר (הזמנה מלאה)" : "תפוס"}
                            >
                              #{b.id} {b.customer_name}
                              {isDragHandleCell && <div style={s.fullDragHint}>גרירה מלאה של ההזמנה</div>}
                              {isBlocker && <div style={s.blockerHint}>חוסם כרגע את הרכב המבוקש</div>}
                              {oneDayBooking ? (
                                <div style={s.conflictMetaText}>יציאה היום {pickup} · חזרה מחר {ret}</div>
                              ) : (
                                <div style={s.conflictMetaText}>מ-{formatDate(b.start_date)} {pickup} עד {formatDate(b.end_date)} {ret}</div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ ...s.conflictFooter, flexDirection: isMobile ? "column-reverse" : "row", alignItems: isMobile ? "stretch" : "center" }}>
              <button
                onClick={() => { setConflictModal(null); setDragItem(null); setDragOverCarId(null); }}
                disabled={resolvingConflict}
                style={{ ...s.btnSecondary, width: isMobile ? "100%" : "auto" }}
              >
                סגור
              </button>
              {resolvingConflict && <span style={s.conflictWorking}>מבצע עדכון...</span>}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm dialogs */}
      <Confirm
        open={confirm?.action === "cancel"}
        message={`לבטל את הזמנה #${confirm?.item?.id} של ${confirm?.item?.customer_name}?`}
        confirmLabel="בטל הזמנה" confirmColor="#f59e0b"
        onConfirm={() => handleCancel(confirm.item)}
        onCancel={() => setConfirm(null)} />
      <Confirm
        open={confirm?.action === "delete"}
        message={`למחוק לצמיתות את הזמנה #${confirm?.item?.id}?`}
        confirmLabel="מחק" confirmColor="#dc2626"
        onConfirm={() => handleDelete(confirm.item)}
        onCancel={() => setConfirm(null)} />

      <Confirm
        open={!!actionConfirm}
        message={actionConfirm?.message || ""}
        messageList={actionConfirm?.messageList || null}
        confirmLabel={actionConfirm?.confirmLabel || "אישור"}
        confirmColor={actionConfirm?.confirmColor || "#1d4ed8"}
        onConfirm={() => closeActionConfirm(true)}
        onCancel={() => closeActionConfirm(false)} />
      <Modal open={!!viewPhotos} onClose={() => setViewPhotos(null)} title={`תמונות הזמנה #${viewPhotos?.id}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {viewPhotos?.drive_link ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {viewPhotos.drive_link.split(",").filter(Boolean).map((url, idx) => (
                <div key={idx} style={{ position: "relative" }}>
                  <img src={url} alt={`Photo ${idx}`} style={{ width: "100%", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <button
                    onClick={() => window.open(url, "_blank")}
                    style={{
                      position: "absolute", bottom: 5, right: 5, background: "rgba(0,0,0,0.6)",
                      color: "#fff", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer"
                    }}
                  >
                    📂 פתח מקור
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 20, color: "#64748b" }}>אין תמונות להצגה</div>
          )}
        </div>
      </Modal>

      {/* Floating Upload Queue Status */}
      {uploadQueue.length > 0 && (
        <div style={{
          position: "fixed", bottom: 20, left: 20, zIndex: 10000,
          background: "#1e293b", color: "#fff", padding: "12px 20px",
          borderRadius: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column", gap: 8, minWidth: 200,
          maxWidth: 300, border: "1px solid #334155"
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, borderBottom: "1px solid #334155", paddingBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span>📤 העלאת תמונות ({uploadQueue.filter(u => u.status !== "done").length})</span>
            <button onClick={() => setUploadQueue([])} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}>נקה הכל</button>
          </div>
          <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {uploadQueue.map(u => (
              <div key={u.id} style={{ fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>
                  #{u.bookingId} - {u.fileName}
                </span>
                <span style={{ 
                  color: u.status === "done" ? "#22c55e" : (u.status === "error" ? "#ef4444" : "#3b82f6"),
                  fontWeight: 600 
                }}>
                  {u.status === "compressing" ? "דוחס..." : 
                   u.status === "uploading" ? "מעלה..." : 
                   u.status === "done" ? "✓ הושלם" : "✘ שגיאה"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
}
function formatDayWithWeekday(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" });
}

const s = {
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20, flexWrap: "wrap", gap: 12
  },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  searchInput: {
    padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 14, outline: "none", minWidth: 220
  },
  select: {
    padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 14, cursor: "pointer", background: "#fff"
  },
  tableWrap: {
    background: "#fff", borderRadius: 12, overflow: "auto",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0"
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "#475569",
    textAlign: "right", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap"
  },
  tr: { borderBottom: "1px solid #f1f5f9", transition: "background 0.1s" },
  td: { padding: "12px 14px", fontSize: 13, verticalAlign: "middle" },
  sub: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  idBadge: {
    background: "#f1f5f9", color: "#475569", borderRadius: 6,
    padding: "2px 7px", fontSize: 12, fontWeight: 700
  },
  btnIcon: {
    background: "none", border: "none", cursor: "pointer", fontSize: 16,
    padding: "2px 5px", borderRadius: 5
  },
  btnPrimary: {
    background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8,
    padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14
  },
  btnSecondary: {
    background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0",
    borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: "pointer"
  },
  customerLinkBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    color: "#1d4ed8",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "underline",
    textUnderlineOffset: 2,
  },
  input: {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 14, outline: "none", boxSizing: "border-box"
  },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: "#475569" },
  timeHint: { fontSize: 10, color: "#94a3b8", fontWeight: 400, marginRight: 4 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, flexWrap: "wrap" },
  errorBox: {
    background: "#fef2f2", color: "#dc2626", borderRadius: 8,
    padding: "10px 14px", fontSize: 13, marginTop: 8
  },
  pricePreview: {
    background: "#eff6ff", color: "#1d4ed8", borderRadius: 8,
    padding: "10px 14px", fontSize: 14, marginBottom: 8
  },
  pagination: { display: "flex", gap: 6, justifyContent: "center", marginTop: 16 },
  pageBtn: {
    width: 36, height: 36, borderRadius: 8, border: "1px solid #e2e8f0",
    cursor: "pointer", fontWeight: 600, fontSize: 13
  },

  conflictIntro: {
    background: "linear-gradient(90deg, #fff7ed 0%, #fffbeb 100%)",
    border: "1px solid #fed7aa",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 13,
    color: "#9a3412",
    marginBottom: 12,
  },
  conflictFilters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginBottom: 10,
  },
  conflictFilterField: { display: "flex", flexDirection: "column", gap: 4 },
  conflictFilterLabel: { fontSize: 12, color: "#475569", fontWeight: 600 },
  conflictClearBtn: { marginRight: 6, fontSize: 10, padding: "1px 6px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer", color: "#64748b" },
  conflictFilterScroll: {
    border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff",
    maxHeight: 130, overflowY: "auto", padding: "4px 0",
  },
  conflictFilterItem: {
    display: "flex", alignItems: "center", gap: 6, padding: "3px 10px",
    cursor: "pointer", fontSize: 12, color: "#374151",
  },
  conflictFilterInput: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    background: "#fff",
  },
  newBookingCardWrap: {
    marginBottom: 12,
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
    padding: 10,
  },
  conflictLegend: {
    marginTop: 8,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 11,
    color: "#475569",
  },
  conflictTableWrap: {
    maxHeight: 450,
    overflow: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
  },
  conflictTable: { borderCollapse: "collapse", width: "100%", minWidth: 780, tableLayout: "fixed" },
  conflictTh: {
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    padding: "8px 6px",
    fontSize: 11,
    color: "#334155",
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
  },
  conflictCarMeta: { marginTop: 2, fontSize: 10, color: "#64748b", fontWeight: 600 },
  conflictStickyCorner: { right: 0, zIndex: 3 },
  conflictTd: {
    borderBottom: "1px solid #f1f5f9",
    padding: "6px 4px",
    fontSize: 11,
    textAlign: "center",
    verticalAlign: "middle",
  },
  conflictStickyDate: {
    position: "sticky",
    right: 0,
    background: "#f8fafc",
    color: "#334155",
    fontWeight: 700,
    zIndex: 1,
  },
  conflictCard: {
    borderRadius: 8,
    padding: "8px 10px",
    border: "1px solid",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    userSelect: "none",
  },
  newBookingCard: {
    background: "#eff6ff",
    borderColor: "#60a5fa",
    borderStyle: "dashed",
    borderWidth: 2,
    color: "#1d4ed8",
    cursor: "grab",
    marginBottom: 0,
    padding: "12px 14px",
    boxShadow: "0 8px 22px rgba(37,99,235,0.18)",
  },
  newBookingBadge: {
    display: "inline-block",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: 10,
    fontWeight: 800,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  newBookingTitle: { fontSize: 14, fontWeight: 800, marginBottom: 3 },
  newBookingMeta: { fontSize: 12, fontWeight: 600, color: "#1e3a8a" },
  conflictCellCard: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "4px 6px",
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    userSelect: "none",
    background: "#fff",
  },
  fullDragHint: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: 700,
    color: "#1d4ed8",
  },
  blockerHint: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: 700,
    color: "#991b1b",
  },
  conflictMetaText: {
    marginTop: 3,
    fontSize: 10,
    color: "#475569",
    fontWeight: 500,
  },
  conflictFooter: { marginTop: 10, display: "flex", alignItems: "center", gap: 10 },
  conflictWorking: { color: "#475569", fontSize: 12, fontWeight: 600 },

  // Smart suggestions panel
  suggestLoading: {
    marginTop: 10, padding: "10px 14px", background: "#fefce8",
    border: "1px solid #fde68a", borderRadius: 8, color: "#92400e", fontSize: 13
  },
  suggestPanel: { marginTop: 10, border: "1px solid #e0e7ff", borderRadius: 10, overflow: "hidden" },
  suggestTitle: {
    background: "#eef2ff", padding: "8px 14px", fontWeight: 700,
    fontSize: 13, color: "#3730a3", borderBottom: "1px solid #e0e7ff"
  },
  suggestCard: { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", background: "#fff" },
  typeBadge: {
    display: "inline-block", borderRadius: 999, padding: "2px 8px", fontSize: 11,
    fontWeight: 700, border: "1px solid", marginLeft: 6
  },
  carName: { fontWeight: 700, fontSize: 14, color: "#0f172a" },
  carMeta: { fontSize: 11, color: "#64748b" },
  suggestSummary: { marginTop: 5, fontSize: 12, color: "#475569" },
  suggestMeta: { marginTop: 4, fontSize: 11, color: "#7c3aed", fontWeight: 600 },
  btnAlt: {
    color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px",
    fontWeight: 700, cursor: "pointer", fontSize: 12
  },
  customerDropdown: {
    position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 20,
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
    boxShadow: "0 8px 20px rgba(15,23,42,0.08)", maxHeight: 200, overflowY: "auto",
  },
  customerItem: {
    width: "100%", textAlign: "right", border: "none", background: "transparent",
    padding: "8px 10px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 2,
  },
  customerItemMuted: { padding: "8px 10px", fontSize: 12, color: "#64748b" },
  customerMeta: { fontSize: 11, color: "#64748b" },
  cooldownBox: {
    padding: "6px 10px", background: "#fff7ed", border: "1px solid #fdba74",
    color: "#9a3412", borderRadius: 6, fontSize: 12, marginBottom: 6
  },
  riskBadge: (level) => ({
    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999,
    background: level === "low" ? "#dcfce7" : level === "medium" ? "#fef9c3" : "#fee2e2",
    color: level === "low" ? "#166534" : level === "medium" ? "#854d0e" : "#991b1b",
    flexShrink: 0,
  }),

  // Date filter bar
  dateFilterBar: {
    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    marginBottom: 14, padding: "8px 12px", background: "#f8fafc",
    borderRadius: 10, border: "1px solid #e2e8f0"
  },
  dateFilterBtn: {
    padding: "5px 14px", borderRadius: 999, border: "1px solid #e2e8f0",
    background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer",
    fontWeight: 500
  },
  dateFilterBtnActive: {
    padding: "5px 14px", borderRadius: 999, border: "1px solid #1d4ed8",
    background: "#1d4ed8", color: "#fff", fontSize: 13, cursor: "pointer",
    fontWeight: 700
  },
  datePickerInline: {
    padding: "5px 10px", borderRadius: 8, border: "1px solid #cbd5e1",
    fontSize: 13, outline: "none", background: "#fff"
  },
  dateFilterHint: { fontSize: 12, color: "#1d4ed8", fontWeight: 600, marginRight: 4 },
  durationBtn: {
    padding: "3px 10px", borderRadius: 999, border: "1px solid #cbd5e1",
    background: "#f1f5f9", color: "#334155", fontSize: 12, cursor: "pointer",
    fontWeight: 600, whiteSpace: "nowrap",
  },
  mobileCardsWrap: { display: "grid", gap: 10 },
  mobileCard: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
    padding: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  mobileCardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  mobileTitle: { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  mobileCustomerLinkBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    color: "#1d4ed8",
    textDecoration: "underline",
    textUnderlineOffset: 2,
    cursor: "pointer",
    textAlign: "right",
    alignSelf: "flex-start",
  },
  mobileDates: { display: "grid", gridTemplateColumns: "1fr", gap: 6, marginTop: 8, fontSize: 12, color: "#334155" },
  mobileFooter: { marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" },
  mobileEmpty: {
    textAlign: "center", background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 12, padding: 24, color: "#94a3b8",
  },
};
