import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def _parse_recipients(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [email.strip() for email in raw.split(",") if email.strip()]


def _send(to: str, subject: str, html: str) -> bool:
    if not settings.EMAILS_ENABLED:
        logger.info(f"[EMAIL DISABLED] To: {to} | Subject: {subject}")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM}>"
        msg["To"] = to
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as srv:
            srv.starttls()
            srv.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            srv.sendmail(settings.EMAILS_FROM, to, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


# ── Templates ──────────────────────────────────────────────────────────────────
def _base_template(title: str, body: str) -> str:
    return f"""
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;
         background:#f8fafc;border-radius:12px;overflow:hidden">
      <div style="background:#1e3a5f;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">🚘 {settings.APP_NAME}</h1>
      </div>
      <div style="padding:32px;background:#fff">
        <h2 style="color:#1e293b">{title}</h2>
        {body}
      </div>
      <div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;background:#f1f5f9">
        {settings.APP_NAME} | נשלח אוטומטית — אין להשיב למייל זה
      </div>
    </div>"""


def send_booking_confirmation(to: str, customer_name: str, car_name: str,
                               start: str, end: str, total: float, booking_id: int) -> bool:
    body = f"""
    <p>שלום <strong>{customer_name}</strong>,</p>
    <p>הזמנתך אושרה בהצלחה! 🎉</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f1f5f9">
        <td style="padding:10px;font-weight:bold">מספר הזמנה</td>
        <td style="padding:10px">#{booking_id}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">רכב</td>
        <td style="padding:10px">{car_name}</td>
      </tr>
      <tr style="background:#f1f5f9">
        <td style="padding:10px;font-weight:bold">מתאריך</td>
        <td style="padding:10px">{start}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">עד תאריך</td>
        <td style="padding:10px">{end}</td>
      </tr>
      <tr style="background:#dbeafe">
        <td style="padding:10px;font-weight:bold">סכום לתשלום</td>
        <td style="padding:10px;font-weight:bold;color:#1d4ed8">₪{total:,.0f}</td>
      </tr>
    </table>
    <p>לשאלות ניתן לפנות אלינו בכל עת.</p>
    <p>תודה שבחרת ב{settings.APP_NAME}!</p>"""
    return _send(to, f"אישור הזמנה #{booking_id} — {settings.APP_NAME}",
                 _base_template("אישור הזמנה", body))


def send_booking_cancellation(to: str, customer_name: str, car_name: str,
                               booking_id: int) -> bool:
    body = f"""
    <p>שלום <strong>{customer_name}</strong>,</p>
    <p>הזמנתך מספר <strong>#{booking_id}</strong> עבור רכב <strong>{car_name}</strong>
       <span style="color:#ef4444">בוטלה</span>.</p>
    <p>אם לדעתך מדובר בטעות, אנא צור קשר עמנו בהקדם.</p>"""
    return _send(to, f"ביטול הזמנה #{booking_id} — {settings.APP_NAME}",
                 _base_template("הזמנה בוטלה", body))


def send_booking_reminder(to: str, customer_name: str, car_name: str,
                           start: str, booking_id: int) -> bool:
    body = f"""
    <p>שלום <strong>{customer_name}</strong>,</p>
    <p>תזכורת: מחר (<strong>{start}</strong>) מתחילה השכרת הרכב שלך — <strong>{car_name}</strong>.</p>
    <p>מספר הזמנה: <strong>#{booking_id}</strong></p>
    <p>נסיעה טובה! 🚗</p>"""
    return _send(to, f"תזכורת להזמנה #{booking_id} — {settings.APP_NAME}",
                 _base_template("תזכורת להזמנה", body))


def send_booking_delete_alert(*, booking_id: int, customer_name: str, car_name: str,
                              start: str, end: str, actor_email: str, actor_role: str) -> bool:
    recipients = _parse_recipients(settings.SECURITY_ALERT_RECIPIENTS)
    if not recipients:
        logger.info("[ALERT EMAIL SKIPPED] No SECURITY_ALERT_RECIPIENTS configured")
        return False

    body = f"""
    <p><strong>התראת אבטחה/תפעול:</strong> בוצעה מחיקה של הזמנה.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#fef2f2">
        <td style="padding:10px;font-weight:bold">מספר הזמנה</td>
        <td style="padding:10px">#{booking_id}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">לקוח</td>
        <td style="padding:10px">{customer_name}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">רכב</td>
        <td style="padding:10px">{car_name}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">מתאריך</td>
        <td style="padding:10px">{start}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">עד תאריך</td>
        <td style="padding:10px">{end}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">בוצע ע"י</td>
        <td style="padding:10px">{actor_email} ({actor_role})</td>
      </tr>
    </table>
    <p style="color:#b91c1c;font-weight:bold">נדרשת בדיקה של הפעולה לפי נוהל.</p>"""

    subject = f"[ALERT] Booking #{booking_id} deleted — {settings.APP_NAME}"
    success = True
    for recipient in recipients:
        success = _send(recipient, subject, _base_template("התראת מחיקת הזמנה", body)) and success
    return success


def send_reassignment_apply_alert(
    *,
    affected_booking_id: int,
    affected_customer_name: str,
    blocked_car_name: str,
    replacement_car_name: str,
    requested_start: str,
    requested_end: str,
    actor_email: str,
    actor_role: str,
    operator_note: str | None = None,
) -> bool:
    recipients = _parse_recipients(settings.SECURITY_ALERT_RECIPIENTS)
    if not recipients:
        logger.info("[ALERT EMAIL SKIPPED] No SECURITY_ALERT_RECIPIENTS configured")
        return False

    note_html = ""
    if operator_note:
        note_html = f"""
      <tr>
        <td style="padding:10px;font-weight:bold">הערת מפעיל</td>
        <td style="padding:10px">{operator_note}</td>
      </tr>"""

    body = f"""
    <p><strong>התראת תפעול:</strong> הוחל שיבוץ מחדש להזמנה קיימת.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#fff7ed">
        <td style="padding:10px;font-weight:bold">מספר הזמנה מושפעת</td>
        <td style="padding:10px">#{affected_booking_id}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">לקוח מושפע</td>
        <td style="padding:10px">{affected_customer_name}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">רכב שהתפנה לבקשה חדשה</td>
        <td style="padding:10px">{blocked_car_name}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">רכב חלופי ללקוח הקיים</td>
        <td style="padding:10px">{replacement_car_name}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">חלון בקשה חדש</td>
        <td style="padding:10px">{requested_start} עד {requested_end}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">בוצע ע"י</td>
        <td style="padding:10px">{actor_email} ({actor_role})</td>
      </tr>
      {note_html}
    </table>
    <p style="color:#b45309;font-weight:bold">הפעולה דורשת תיעוד ובקרה לפי נוהל.</p>"""

    subject = f"[ALERT] Reassignment applied for booking #{affected_booking_id} — {settings.APP_NAME}"
    success = True
    for recipient in recipients:
        success = _send(recipient, subject, _base_template("התראת שיבוץ מחדש", body)) and success
    return success

