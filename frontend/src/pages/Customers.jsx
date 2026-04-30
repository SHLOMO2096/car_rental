import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import Confirm from "../components/ui/Confirm";
import Modal from "../components/ui/Modal";
import { customersAPI } from "../api/customers";
import { getUserFacingErrorMessage } from "../api/errors";
import { Permissions } from "../permissions";
import { useAuthStore } from "../store/auth";
import { toast } from "../store/toast";
import { useIsMobile } from "../hooks/useIsMobile";

const EMPTY_FORM = { name: "", address: "", phone: "", email: "", id_number: "" };
const EMPTY_EMAIL_FORM = { subject: "", body: "" };
const STATUS_LABELS = { active: "פעיל", completed: "הושלם", cancelled: "בוטל" };

const AUDIENCE_OPTIONS = [
  { value: "all",           label: "כל הלקוחות עם מייל" },
  { value: "active",        label: "לקוחות עם הזמנות פעילות בלבד" },
  { value: "with_bookings", label: "לקוחות עם היסטוריית הזמנות" },
];

const BULK_TEMPLATES = [
  { id: "", label: "— ללא תבנית —", subject: "", body: "" },
  {
    id: "promo",
    label: "🏷️ מבצע מיוחד",
    subject: "מבצע מיוחד ללקוחות שלנו!",
    body: "<h3>🎉 מבצע מיוחד!</h3><p>אנו שמחים להציע לך הטבה בלעדית:</p><ul><li><strong>הנחה של 20%</strong> על השכרה לסוף שבוע</li><li>תוקף עד: <strong>[תאריך]</strong></li></ul><p>לפרטים והזמנה — צור קשר עמנו בהקדם 📞</p>",
  },
  {
    id: "hours",
    label: "🕐 עדכון שעות פתיחה",
    subject: "עדכון שעות פתיחה",
    body: "<h3>שינוי שעות פתיחה</h3><p>ברצוננו לעדכנך כי <strong>שעות הפתיחה שלנו השתנו:</strong></p><ul><li>ראשון–חמישי: <strong>08:00–19:00</strong></li><li>שישי: <strong>08:00–13:00</strong></li><li>שבת: סגור</li></ul><p>נשמח לשרת אותך בשעות הפעילות החדשות 😊</p>",
  },
  {
    id: "holiday",
    label: "🎊 ברכת חג",
    subject: "ברכות לרגל החג",
    body: "<h3>חג שמח! 🎊</h3><p>לכבוד החג, אנו סוגרים ביום <strong>[תאריך]</strong>.</p><p>נחזור לפעילות מלאה ביום <strong>[תאריך]</strong>.</p><p>מאחלים לך ולמשפחתך חג שמח, מנוחה ושמחה! 🌟</p>",
  },
  {
    id: "reminder",
    label: "🔔 תזכורת כללית",
    subject: "תזכורת מאיתנו",
    body: "<h3>תזכורת מאיתנו 🔔</h3><p>שלום יקרנו,</p><p>רצינו להזכיר לך שאנחנו כאן בשבילך לכל צורך בהשכרת רכב.</p><p>לתיאום הזמנה מהיר וקל — צור קשר עמנו:</p><ul><li>📞 טלפון: <strong>[מספר טלפון]</strong></li><li>📧 מייל: <strong>[כתובת מייל]</strong></li></ul>",
  },
  {
    id: "return",
    label: "🚗 החזרת לקוח",
    subject: "מתגעגעים אליך! הטבה מיוחדת",
    body: "<h3>מתגעגעים אליך! 🚗</h3><p>עבר זמן מאז ההשכרה האחרונה שלך, ורצינו להזכיר לך שאנחנו כאן.</p><p>כמחווה של הוקרה — <strong>קבל 10% הנחה</strong> על ההשכרה הבאה שלך!</p><p>פשוט ציין קוד קידום-מכירות: <strong>[קוד]</strong> בעת ההזמנה.</p>",
  },
];

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
}

function toWhatsAppUrl(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("972")) return `https://wa.me/${digits}`;
  if (digits.startsWith("0")) return `https://wa.me/972${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

export default function Customers() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const rowRefs = useRef({});
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [emailCustomer, setEmailCustomer] = useState(null);
  const [emailForm, setEmailForm] = useState(EMPTY_EMAIL_FORM);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkEmailAudience, setBulkEmailAudience] = useState("all");
  const [bulkEditorKey, setBulkEditorKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const isMobile = useIsMobile(900);
  const canSendBulkEmail = useAuthStore((s) => s.can(Permissions.CUSTOMERS_BULK_EMAIL));

  const load = useCallback(async (q = "") => {
    try {
      const rows = await customersAPI.list({ q, limit: 200 });
      setCustomers(rows || []);
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), 180);
    return () => clearTimeout(t);
  }, [search, load]);

  // Handle navigation from Dashboard → highlight specific customer
  useEffect(() => {
    const hid = location.state?.highlightCustomerId;
    const prefill = String(location.state?.customerSearchPrefill || "").trim();
    if (!hid && !prefill) return;

    if (prefill) setSearch(prefill);
    if (!hid) {
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    setHighlightId(hid);
    navigate(location.pathname, { replace: true, state: {} });
    // Scroll to the row after customers load
    const timer = setTimeout(() => {
      const el = rowRefs.current[hid];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightId(null), 3000);
    }, 400);
    return () => clearTimeout(timer);
  }, [location.state, location.pathname, navigate]);

  async function handleCreate() {
    if (!form.name.trim()) return toast.error("יש להזין שם לקוח");
    setSaving(true);
    try {
      await customersAPI.create({
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        id_number: form.id_number.trim() || null,
      });
      setForm(EMPTY_FORM);
      await load(search.trim());
      toast.success("הלקוח נשמר בהצלחה");
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function bookForCustomer(customer) {
    navigate("/bookings", {
      state: {
        bookingPrefill: {
          customer_id: customer.id,
          customer_name: customer.name || "",
          customer_email: customer.email || "",
          customer_phone: customer.phone || "",
          customer_id_num: customer.id_number || "",
        },
      },
    });
  }

  async function openHistory(customer) {
    setHistoryCustomer(customer);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const data = await customersAPI.history(customer.id, 20);
      setHistoryData(data);
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setHistoryLoading(false);
    }
  }

  function openEdit(customer) {
    setEditCustomer(customer);
    setForm({
      name: customer.name || "",
      address: customer.address || "",
      phone: customer.phone || "",
      email: customer.email || "",
      id_number: customer.id_number || "",
    });
  }

  async function handleUpdate() {
    if (!editCustomer) return;
    if (!form.name.trim()) return toast.error("יש להזין שם לקוח");
    setSaving(true);
    try {
      await customersAPI.update(editCustomer.id, {
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        id_number: form.id_number.trim() || null,
      });
      setEditCustomer(null);
      setForm(EMPTY_FORM);
      await load(search.trim());
      toast.success("פרטי הלקוח עודכנו בהצלחה");
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await customersAPI.delete(confirmDelete.id);
      await load(search.trim());
      toast.success("הלקוח נמחק בהצלחה");
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const result = await customersAPI.importFile(file);
      await load(search.trim());
      setImportReport(result);
      toast.success(`ייבוא הושלם: ${result.inserted} חדשים, ${result.updated} עודכנו, ${result.skipped || 0} דולגו`);
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setImporting(false);
    }
  }

  function openEmail(customer) {
    setEmailCustomer(customer);
    setEmailForm({
      subject: "הודעה ממערכת השכרת רכבים",
      body: `שלום ${customer.name},\n\n`,
    });
  }

  async function handleSendEmail() {
    if (!emailCustomer) return;
    if (!emailForm.subject.trim() || !emailForm.body.trim()) {
      return toast.error("יש להזין נושא ותוכן למייל");
    }
    setSendingEmail(true);
    try {
      await customersAPI.sendEmail(emailCustomer.id, {
        subject: emailForm.subject.trim(),
        body: emailForm.body.trim(),
      });
      setEmailCustomer(null);
      setEmailForm(EMPTY_EMAIL_FORM);
      toast.success("המייל נשלח בהצלחה");
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setSendingEmail(false);
    }
  }

  function openBulkEmail() {
    setBulkEmailOpen(true);
    setBulkEmailAudience("all");
    setBulkEditorKey((k) => k + 1);
    setEmailForm({
      subject: "עדכון ללקוחות",
      body: "<p>שלום,</p><p>רצינו לעדכן במבצעים מיוחדים, שעות פתיחה או הודעה חשובה אחרת.</p><p>בברכה,</p>",
    });
  }

  function applyBulkTemplate(templateId) {
    const tpl = BULK_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl || !tpl.id) return;
    setEmailForm((f) => ({ ...f, subject: tpl.subject, body: tpl.body }));
    setBulkEditorKey((k) => k + 1);
  }

  async function handleSendBulkEmail() {
    if (!emailForm.subject.trim() || !emailForm.body.trim()) {
      return toast.error("יש להזין נושא ותוכן למייל");
    }
    setSendingEmail(true);
    try {
      const result = await customersAPI.sendBulkEmail({
        subject: emailForm.subject.trim(),
        body: emailForm.body.trim(),
        audience: bulkEmailAudience,
      });
      setBulkEmailOpen(false);
      setEmailForm(EMPTY_EMAIL_FORM);
      const skipped = result?.skipped ? `, ${result.skipped} דולגו` : "";
      toast.success(`ההודעה נשלחה ל-${result?.queued || 0} לקוחות${skipped}`);
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e));
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div dir="rtl">
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xlsm" onChange={handleImportFile} style={{ display: "none" }} />

      <div style={s.header}>
        <h1 style={s.h1}>ניהול לקוחות</h1>
        <div style={{ ...s.topActions, width: isMobile ? "100%" : "auto" }}>
          <input
            placeholder="🔍 חיפוש לפי שם / טלפון / מייל / תעודת זהות"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...s.searchInput, minWidth: isMobile ? "100%" : 320 }}
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} style={{ ...s.btnImport, width: isMobile ? "100%" : "auto" }}>
            {importing ? "מייבא..." : "⬆️ ייבוא לקוחות"}
          </button>
          {canSendBulkEmail && (
            <button onClick={openBulkEmail} style={{ ...s.btnEmailPrimary, width: isMobile ? "100%" : "auto" }}>📣 הודעה לכל הלקוחות</button>
          )}
        </div>
      </div>

      <div style={s.card}>
        <h3 style={s.cardTitle}>הוספת לקוח</h3>
        <div style={s.formGrid}>
          <input value={form.name} placeholder="שם לקוח *" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={s.input} />
          <input value={form.id_number} placeholder="תעודת זהות / ח.פ" onChange={(e) => setForm((f) => ({ ...f, id_number: e.target.value }))} style={s.input} />
          <input value={form.phone} placeholder="טלפון" onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={s.input} />
          <input value={form.email} placeholder="אימייל" onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={s.input} />
          <input value={form.address} placeholder="כתובת" onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={{ ...s.input, gridColumn: "1/-1" }} />
        </div>
        <div style={{ marginTop: 10 }}>
          <button onClick={handleCreate} disabled={saving} style={{ ...s.btnPrimary, width: isMobile ? "100%" : "auto" }}>{saving ? "שומר..." : "שמור לקוח"}</button>
        </div>
      </div>

      <div style={s.counter}>{customers.length} לקוחות מוצגים</div>

      {!isMobile ? (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "שם", "ת.ז / ח.פ", "כתובת", "טלפון", "מייל", "פעולות"].map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={s.empty}>טוען...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} style={s.empty}>לא נמצאו לקוחות</td></tr>
              ) : customers.map((c) => (
                <tr key={c.id} ref={el => rowRefs.current[c.id] = el} style={{
                  ...s.tr,
                  ...(highlightId === c.id ? { background:"#fef9c3", outline:"2px solid #f59e0b" } : {}),
                  transition:"background 0.5s",
                }}>
                  <td style={s.td}>#{c.id}</td>
                  <td style={s.td}><strong>{c.name}</strong></td>
                  <td style={s.td}>{c.id_number || "—"}</td>
                  <td style={s.td}>{c.address || "—"}</td>
                  <td style={s.td}>{c.phone || "—"}</td>
                  <td style={s.td}>{c.email || "—"}</td>
                  <td style={s.td}>
                    <div style={s.actionsWrap}>
                      <button onClick={() => bookForCustomer(c)} style={s.btnBook}>📅 הזמן רכב</button>
                      <button onClick={() => openHistory(c)} style={s.btnHistory}>🕘 היסטוריה</button>
                      <button onClick={() => openEdit(c)} style={s.btnEdit}>✏️ ערוך</button>
                      <button onClick={() => setConfirmDelete(c)} style={s.btnDelete}>🗑 מחק</button>
                      {!!c.email && <button onClick={() => openEmail(c)} style={s.btnEmail}>✉️ שלח מייל</button>}
                      {toWhatsAppUrl(c.phone) && (
                        <a href={toWhatsAppUrl(c.phone)} target="_blank" rel="noreferrer" style={s.btnWhatsApp}>💬 WhatsApp</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={s.mobileCardsWrap}>
          {loading && <div style={s.mobileEmpty}>טוען...</div>}
          {!loading && customers.length === 0 && <div style={s.mobileEmpty}>לא נמצאו לקוחות</div>}
          {!loading && customers.map((c) => (
            <div key={c.id} ref={el => rowRefs.current[c.id] = el} style={{
              ...s.mobileCard,
              ...(highlightId === c.id ? { background:"#fef9c3", outline:"2px solid #f59e0b" } : {}),
              transition:"background 0.5s",
            }}>
              <div style={s.mobileCardTitle}>#{c.id} · {c.name}</div>
              <div style={s.mobileMeta}>{c.id_number ? `🪪 ${c.id_number}` : "🪪 —"}</div>
              <div style={s.mobileMeta}>{c.phone ? `📞 ${c.phone}` : "📞 —"}</div>
              <div style={s.mobileMeta}>{c.email ? `📧 ${c.email}` : "📧 —"}</div>
              <div style={s.mobileMeta}>{c.address ? `📍 ${c.address}` : "📍 —"}</div>
              <div style={s.actionsWrap}>
                <button onClick={() => bookForCustomer(c)} style={s.btnBook}>📅 הזמן</button>
                <button onClick={() => openHistory(c)} style={s.btnHistory}>🕘 היסטוריה</button>
                <button onClick={() => openEdit(c)} style={s.btnEdit}>✏️ ערוך</button>
                <button onClick={() => setConfirmDelete(c)} style={s.btnDelete}>🗑 מחק</button>
                {!!c.email && <button onClick={() => openEmail(c)} style={s.btnEmail}>✉️ מייל</button>}
                {toWhatsAppUrl(c.phone) && (
                  <a href={toWhatsAppUrl(c.phone)} target="_blank" rel="noreferrer" style={s.btnWhatsApp}>💬 WhatsApp</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!historyCustomer} onClose={() => { setHistoryCustomer(null); setHistoryData(null); }} title={historyCustomer ? `היסטוריית לקוח — ${historyCustomer.name}` : "היסטוריית לקוח"} wide>
        {historyLoading && <div style={s.empty}>טוען היסטוריה...</div>}
        {!historyLoading && historyData && (
          <div>
            <div style={s.summaryGrid}>
              <div style={s.summaryCard}><span style={s.summaryLabel}>סה״כ הזמנות</span><strong>{historyData.summary.total_bookings}</strong></div>
              <div style={s.summaryCard}><span style={s.summaryLabel}>הזמנות פעילות</span><strong>{historyData.summary.active_bookings}</strong></div>
              <div style={s.summaryCard}><span style={s.summaryLabel}>הכנסה כוללת</span><strong>₪{Math.round(historyData.summary.total_revenue || 0).toLocaleString()}</strong></div>
              <div style={s.summaryCard}><span style={s.summaryLabel}>הזמנה אחרונה</span><strong>{formatDate(historyData.summary.last_booking_date)}</strong></div>
            </div>

            <div style={s.historyMeta}>
              {historyData.customer.id_number && <span>🪪 {historyData.customer.id_number}</span>}
              {historyData.customer.phone && <span>📞 {historyData.customer.phone}</span>}
              {historyData.customer.email && <span>📧 {historyData.customer.email}</span>}
              {historyData.customer.address && <span>📍 {historyData.customer.address}</span>}
            </div>

            <div style={s.historyTableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["#", "רכב", "מתאריך", "עד תאריך", "סטטוס", "סכום"].map((h) => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {historyData.bookings.length === 0 ? (
                    <tr><td colSpan={6} style={s.empty}>אין היסטוריית הזמנות ללקוח זה</td></tr>
                  ) : historyData.bookings.map((b) => (
                    <tr key={b.id} style={s.tr}>
                      <td style={s.td}>#{b.id}</td>
                      <td style={s.td}>{b.car?.name || `רכב #${b.car_id}`}</td>
                      <td style={s.td}>{formatDate(b.start_date)}</td>
                      <td style={s.td}>{formatDate(b.end_date)}</td>
                      <td style={s.td}>{STATUS_LABELS[b.status] || b.status}</td>
                      <td style={s.td}>{b.total_price ? `₪${Math.round(b.total_price).toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={s.modalFooter}>
              <button onClick={() => historyCustomer && bookForCustomer(historyCustomer)} style={s.btnBook}>📅 הזמן רכב ללקוח</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!importReport} onClose={() => setImportReport(null)} title="דוח ייבוא לקוחות" wide>
        {importReport && (
          <div>
            <div style={s.summaryGrid}>
              <div style={s.summaryCard}><span style={s.summaryLabel}>מעובדים</span><strong>{importReport.processed}</strong></div>
              <div style={s.summaryCard}><span style={s.summaryLabel}>חדשים</span><strong>{importReport.inserted}</strong></div>
              <div style={s.summaryCard}><span style={s.summaryLabel}>עודכנו</span><strong>{importReport.updated}</strong></div>
              <div style={s.summaryCard}><span style={s.summaryLabel}>דולגו</span><strong>{importReport.skipped || 0}</strong></div>
            </div>
            <div style={s.historyTableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["שורה", "רמה", "שדה", "פירוט"].map((h) => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {!importReport.issues || importReport.issues.length === 0 ? (
                    <tr><td colSpan={4} style={s.empty}>אין שגיאות ייבוא</td></tr>
                  ) : importReport.issues.map((issue, idx) => (
                    <tr key={`${issue.row}-${idx}`} style={s.tr}>
                      <td style={s.td}>{issue.row || "—"}</td>
                      <td style={s.td}>{issue.level === "error" ? "שגיאה" : "אזהרה"}</td>
                      <td style={s.td}>{issue.field || "—"}</td>
                      <td style={s.td}>{issue.message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editCustomer} onClose={() => { setEditCustomer(null); setForm(EMPTY_FORM); }} title={editCustomer ? `עריכת לקוח — ${editCustomer.name}` : "עריכת לקוח"}>
        <div style={{ ...s.formGrid, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(180px,1fr))" }}>
          <input value={form.name} placeholder="שם לקוח *" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={s.input} />
          <input value={form.id_number} placeholder="תעודת זהות / ח.פ" onChange={(e) => setForm((f) => ({ ...f, id_number: e.target.value }))} style={s.input} />
          <input value={form.phone} placeholder="טלפון" onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={s.input} />
          <input value={form.email} placeholder="אימייל" onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={s.input} />
          <input value={form.address} placeholder="כתובת" onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} style={{ ...s.input, gridColumn: "1/-1" }} />
        </div>
        <div style={s.modalFooterActions}>
          <button onClick={() => { setEditCustomer(null); setForm(EMPTY_FORM); }} style={{ ...s.btnSecondary, width: isMobile ? "100%" : "auto" }}>ביטול</button>
          <button onClick={handleUpdate} disabled={saving} style={{ ...s.btnPrimary, width: isMobile ? "100%" : "auto" }}>{saving ? "שומר..." : "שמור שינויים"}</button>
        </div>
      </Modal>

      <Modal open={!!emailCustomer} onClose={() => { setEmailCustomer(null); setEmailForm(EMPTY_EMAIL_FORM); }} title={emailCustomer ? `שליחת מייל ל-${emailCustomer.name}` : "שליחת מייל"}>
        <div style={s.formGridSingle}>
          <input value={emailForm.subject} placeholder="נושא" onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))} style={s.input} />
          <textarea value={emailForm.body} rows={7} placeholder="תוכן ההודעה" onChange={(e) => setEmailForm((f) => ({ ...f, body: e.target.value }))} style={{ ...s.input, resize: "vertical" }} />
        </div>
        <div style={s.modalFooterActions}>
          <button onClick={() => { setEmailCustomer(null); setEmailForm(EMPTY_EMAIL_FORM); }} style={{ ...s.btnSecondary, width: isMobile ? "100%" : "auto" }}>ביטול</button>
          <button onClick={handleSendEmail} disabled={sendingEmail} style={{ ...s.btnEmailPrimary, width: isMobile ? "100%" : "auto" }}>{sendingEmail ? "שולח..." : "שלח מייל"}</button>
        </div>
      </Modal>

      <Modal open={bulkEmailOpen} onClose={() => { setBulkEmailOpen(false); setEmailForm(EMPTY_EMAIL_FORM); }} title="שליחת הודעה לכל הלקוחות" wide>
        <div style={s.formGridSingle}>

          {/* Audience */}
          <div>
            <label style={s.fieldLabel}>👥 קהל יעד</label>
            <div style={s.audienceRow}>
              {AUDIENCE_OPTIONS.map((opt) => (
                <label key={opt.value} style={{
                  ...s.audienceOption,
                  ...(bulkEmailAudience === opt.value ? s.audienceOptionActive : {}),
                }}>
                  <input
                    type="radio"
                    name="audience"
                    value={opt.value}
                    checked={bulkEmailAudience === opt.value}
                    onChange={() => setBulkEmailAudience(opt.value)}
                    style={{ marginLeft: 6 }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Template selector */}
          <div>
            <label style={s.fieldLabel}>📋 תבנית מוכנה</label>
            <select
              defaultValue=""
              onChange={(e) => applyBulkTemplate(e.target.value)}
              style={s.input}
            >
              {BULK_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label style={s.fieldLabel}>נושא המייל</label>
            <input
              value={emailForm.subject}
              placeholder="נושא"
              onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
              style={s.input}
            />
          </div>

          {/* Rich text editor */}
          <div>
            <label style={s.fieldLabel}>תוכן ההודעה</label>
            <RichTextEditor
              key={bulkEditorKey}
              value={emailForm.body}
              onChange={(html) => setEmailForm((f) => ({ ...f, body: html }))}
            />
          </div>

          <div style={s.infoBox}>
            ההודעה תישלח לכל הלקוחות עם כתובת מייל בקהל היעד שנבחר.
            אפשר להשתמש בתבניות מוכנות או לכתוב הודעה חופשית.
          </div>
        </div>
        <div style={s.modalFooterActions}>
          <button onClick={() => { setBulkEmailOpen(false); setEmailForm(EMPTY_EMAIL_FORM); }} style={{ ...s.btnSecondary, width: isMobile ? "100%" : "auto" }}>ביטול</button>
          <button onClick={handleSendBulkEmail} disabled={sendingEmail} style={{ ...s.btnEmailPrimary, width: isMobile ? "100%" : "auto" }}>{sendingEmail ? "שולח..." : "שלח לכל הלקוחות"}</button>
        </div>
      </Modal>

      <Confirm
        open={!!confirmDelete}
        message={`למחוק את הלקוח "${confirmDelete?.name}"? הקישור להזמנות יוסר אך נתוני ההזמנות יישמרו.`}
        confirmLabel="מחק לקוח"
        confirmColor="#dc2626"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

const s = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  topActions: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  searchInput: { minWidth: 320, padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none" },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 14 },
  cardTitle: { margin: "0 0 10px", fontSize: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 },
  formGridSingle: { display: "grid", gap: 12 },
  fieldLabel: { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box" },
  btnPrimary: { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" },
  btnSecondary: { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" },
  btnImport: { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" },
  btnEmailPrimary: { background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" },
  infoBox: { background: "#f0fdfa", color: "#115e59", border: "1px solid #99f6e4", borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 1.7 },
  counter: { fontSize: 13, color: "#64748b", marginBottom: 10 },
  tableWrap: { background: "#fff", borderRadius: 12, overflow: "auto", border: "1px solid #e2e8f0" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "11px 12px", textAlign: "right", fontSize: 12, color: "#475569", borderBottom: "1px solid #e2e8f0" },
  tr: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "10px 12px", fontSize: 13, verticalAlign: "top" },
  empty: { textAlign: "center", padding: 28, color: "#94a3b8" },
  actionsWrap: { display: "flex", gap: 6, flexWrap: "wrap" },
  btnBook: { background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", borderRadius: 7, padding: "6px 10px", fontWeight: 700, cursor: "pointer" },
  btnHistory: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 7, padding: "6px 10px", fontWeight: 700, cursor: "pointer" },
  btnEdit: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fdba74", borderRadius: 7, padding: "6px 10px", fontWeight: 700, cursor: "pointer" },
  btnDelete: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, padding: "6px 10px", fontWeight: 700, cursor: "pointer" },
  btnEmail: { background: "#ecfeff", color: "#0f766e", border: "1px solid #99f6e4", borderRadius: 7, padding: "6px 10px", fontWeight: 700, cursor: "pointer" },
  btnWhatsApp: { background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7", borderRadius: 7, padding: "6px 10px", fontWeight: 700, cursor: "pointer", textDecoration: "none" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 12 },
  summaryCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 },
  summaryLabel: { color: "#64748b", fontSize: 12 },
  historyMeta: { display: "flex", gap: 12, flexWrap: "wrap", color: "#475569", fontSize: 12, marginBottom: 12 },
  historyTableWrap: { background: "#fff", borderRadius: 12, overflow: "auto", border: "1px solid #e2e8f0" },
  modalFooter: { display: "flex", justifyContent: "flex-end", marginTop: 14 },
  modalFooterActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" },
  audienceRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  audienceOption: {
    display: "flex", alignItems: "center", gap: 4,
    padding: "6px 12px", borderRadius: 20, fontSize: 13,
    border: "1px solid #e2e8f0", background: "#f8fafc",
    color: "#475569", cursor: "pointer", fontWeight: 500,
  },
  audienceOptionActive: {
    border: "1px solid #0d9488", background: "#f0fdfa", color: "#0f766e", fontWeight: 700,
  },
  mobileCardsWrap: { display: "grid", gap: 10 },
  mobileCard: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
    padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  mobileCardTitle: { fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 },
  mobileMeta: { fontSize: 12, color: "#475569", marginBottom: 4 },
  mobileEmpty: {
    textAlign: "center", background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 12, padding: 24, color: "#94a3b8",
  },
};

// ── Rich Text Editor ──────────────────────────────────────────────────────────
function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const lastHtmlRef = useRef(value || "");

  // Initialize on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || "";
      lastHtmlRef.current = value || "";
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when value changes externally (e.g., template selection, indicated by a key change on parent)
  useEffect(() => {
    if (editorRef.current && value !== lastHtmlRef.current) {
      editorRef.current.innerHTML = value || "";
      lastHtmlRef.current = value || "";
    }
  }, [value]);

  function exec(cmd, arg = null) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    const html = editorRef.current?.innerHTML || "";
    lastHtmlRef.current = html;
    onChange(html);
  }

  function handleInput() {
    const html = editorRef.current?.innerHTML || "";
    lastHtmlRef.current = html;
    onChange(html);
  }

  const TB_BTN = {
    background: "none", border: "1px solid transparent", borderRadius: 5,
    padding: "3px 8px", cursor: "pointer", fontSize: 13, color: "#334155",
    fontFamily: "inherit", lineHeight: 1.4,
  };

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", gap: 2, padding: "6px 8px",
        background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap",
      }}>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} style={TB_BTN} title="מודגש"><b>B</b></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} style={TB_BTN} title="נטוי"><i>I</i></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} style={TB_BTN} title="קו תחתון"><u>U</u></button>
        <span style={{ width: 1, background: "#e2e8f0", margin: "2px 4px", display: "inline-block" }} />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("formatBlock", "h3"); }} style={TB_BTN} title="כותרת">H₃</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("formatBlock", "p"); }} style={TB_BTN} title="פסקה רגילה">¶</button>
        <span style={{ width: 1, background: "#e2e8f0", margin: "2px 4px", display: "inline-block" }} />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} style={TB_BTN} title="רשימת תבליטים">• רשימה</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }} style={TB_BTN} title="רשימה ממוספרת">1. רשימה</button>
        <span style={{ width: 1, background: "#e2e8f0", margin: "2px 4px", display: "inline-block" }} />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }} style={{ ...TB_BTN, color: "#94a3b8" }} title="נקה עיצוב">✕</button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        dir="rtl"
        onInput={handleInput}
        style={{
          minHeight: 200, padding: "12px 14px", outline: "none",
          fontSize: 14, lineHeight: 1.8, direction: "rtl", textAlign: "right",
          color: "#0f172a", background: "#fff",
        }}
      />
    </div>
  );
}

