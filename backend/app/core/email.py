import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.text import MIMEText
from app.core.config import settings
from app.core.signature import SignatureConfig, get_business_signature, get_logo_bytes

logger = logging.getLogger(__name__)


def _sender_display_name() -> str:
    raw = (settings.EMAILS_FROM_NAME or "").strip()
    if not raw:
        return SignatureConfig.BUSINESS_NAME

    normalized = raw.replace("ןןאי", "וואי").replace("ווי קאר", "וואי קאר")
    if normalized.lower() == "waycar":
        return SignatureConfig.BUSINESS_NAME
    return normalized


def _customer_subject(base: str, booking_id: int | None = None) -> str:
    booking_suffix = f" #{booking_id}" if booking_id is not None else ""
    return f"{base}{booking_suffix} | וואי קאר השכרת רכב"


def _parse_recipients(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [email.strip() for email in raw.split(",") if email.strip()]


def _send(to: str, subject: str, html: str) -> bool:
    if not settings.EMAILS_ENABLED:
        logger.info(f"[EMAIL DISABLED] To: {to} | Subject: {subject}")
        return True
    try:
        msg = MIMEMultipart("related")
        msg["Subject"] = subject
        msg["From"] = f"{_sender_display_name()} <{settings.EMAILS_FROM}>"
        msg["To"] = to

        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(html, "html", "utf-8"))
        msg.attach(alt)

        logo_bytes = get_logo_bytes()
        if logo_bytes:
            logo = MIMEImage(logo_bytes)
            logo.add_header("Content-ID", "<waycar-logo>")
            logo.add_header("Content-Disposition", "inline", filename="logo.jpg")
            msg.attach(logo)

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
    signature = get_business_signature()
    header_logo_html = ""
    if get_logo_bytes():
        header_logo_html = (
            '<div style="margin-bottom:8px">'
            '<img src="cid:waycar-logo" alt="וואי קאר" style="width:190px;max-width:100%;height:auto;display:block;margin:0 auto" />'
            '</div>'
        )
    return f"""
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#eef4fb;padding:14px;border-radius:24px">
      <div style="background:linear-gradient(135deg,#16365e 0%,#234a7d 100%);padding:18px 20px 16px;text-align:center;border-radius:22px 22px 0 0">
        {header_logo_html}
        <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.2px;line-height:1.2">וואי קאר השכרת רכב</div>
        <div style="color:#d6e5f7;font-size:13px;margin-top:6px">חוויה מהירה, נקייה ומדויקת להזמנה שלך</div>
      </div>
      <div style="padding:28px;background:#ffffff;border-radius:0 0 22px 22px;box-shadow:0 10px 28px rgba(15,23,42,0.08)">
        <div style="display:inline-block;background:#e8f1fb;color:#0f3f75;border-radius:999px;padding:9px 16px;font-size:14px;font-weight:700;margin-bottom:18px">{title}</div>
        {body}
        {signature}
      </div>
      <div style="padding:12px 6px 0;text-align:center;color:#7b8ba3;font-size:12px">
        נשלח אוטומטית מוואי קאר — אין צורך להשיב למייל זה
      </div>
    </div>"""


def send_booking_confirmation(to: str, customer_name: str, car_name: str,
                               start: str, end: str, total: float, booking_id: int) -> bool:
    body = f"""
    <p style="margin:0 0 12px;font-size:16px;color:#1e293b">שלום <strong>{customer_name}</strong>,</p>
    <p style="margin:0 0 18px;color:#334155;font-size:15px">הזמנתך אושרה בהצלחה ואנחנו כבר מכינים הכול עבורך.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f1f5f9">
        <td style="padding:10px;font-weight:bold">מספר הזמנה</td>
        <td style="padding:10px">#{booking_id}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">קטגוריה</td>
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
    <p style="margin:16px 0 8px;color:#334155">לשאלות ניתן לפנות אלינו בכל עת.</p>
    <p style="margin:0;color:#0f3f75;font-weight:700">תודה שבחרת בוואי קאר!</p>"""
    return _send(to, _customer_subject("אישור הזמנה", booking_id),
                 _base_template("אישור הזמנה", body))


def send_booking_cancellation(to: str, customer_name: str, car_name: str,
                               booking_id: int) -> bool:
    body = f"""
    <p style="margin:0 0 12px;font-size:16px;color:#1e293b">שלום <strong>{customer_name}</strong>,</p>
    <p>הזמנתך מספר <strong>#{booking_id}</strong> עבור קטגוריה <strong>{car_name}</strong>
       <span style="color:#ef4444">בוטלה</span>.</p>
    <p>אם לדעתך מדובר בטעות, אנא צור קשר עמנו בהקדם.</p>"""
    return _send(to, _customer_subject("ביטול הזמנה", booking_id),
                 _base_template("הזמנה בוטלה", body))


def send_booking_reminder(to: str, customer_name: str, car_name: str,
                           start: str, booking_id: int) -> bool:
    body = f"""
    <p style="margin:0 0 12px;font-size:16px;color:#1e293b">שלום <strong>{customer_name}</strong>,</p>
    <p>תזכורת: מחר (<strong>{start}</strong>) מתחילה ההשכרה שלך — <strong>{car_name}</strong>.</p>
    <p>מספר הזמנה: <strong>#{booking_id}</strong></p>
    <p style="margin:0;color:#0f3f75;font-weight:700">מאחלים לך נסיעה נעימה ובטוחה.</p>"""
    return _send(to, _customer_subject("תזכורת להזמנה", booking_id),
                 _base_template("תזכורת להזמנה", body))


def send_customer_message(*, to: str, customer_name: str, subject: str, body: str) -> bool:
    import re as _re
    # If body contains HTML tags render as-is; otherwise escape + preserve newlines
    if _re.search(r'<[a-zA-Z][^>]*>', body):
        rendered = f'<div style="line-height:1.8">{body}</div>'
    else:
        safe = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        rendered = f'<div style="line-height:1.8;white-space:pre-wrap">{safe}</div>'
    html = f"""
    <p>שלום <strong>{customer_name}</strong>,</p>
    {rendered}
    <p style="margin-top:20px">בברכה,<br />{settings.APP_NAME}</p>
    """
    return _send(to, subject, _base_template(subject, html))


def send_booking_delete_alert(*, booking_id: int, customer_name: str, car_name: str,
                              start: str, end: str, actor_email: str, actor_role: str,
                              created_by_name: str | None = None, operator_note: str | None = None) -> bool:
    recipients = _parse_recipients(settings.SECURITY_ALERT_RECIPIENTS)
    if not recipients:
        logger.info("[ALERT EMAIL SKIPPED] No SECURITY_ALERT_RECIPIENTS configured")
        return False

    created_by_row = ""
    if created_by_name:
        created_by_row = f"""
      <tr>
        <td style="padding:10px;font-weight:bold">יוצר ההזמנה</td>
        <td style="padding:10px">{created_by_name}</td>
      </tr>"""

    operator_note_row = ""
    if operator_note:
        operator_note_row = f"""
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">הערת מפעיל</td>
        <td style="padding:10px">{operator_note}</td>
      </tr>"""

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
      {created_by_row}
      {operator_note_row}
    </table>
    <p style="color:#b91c1c;font-weight:bold">נדרשת בדיקה של הפעולה לפי נוהל.</p>"""

    subject = f"[ALERT] Booking #{booking_id} deleted — {settings.APP_NAME}"
    success = True
    for recipient in recipients:
        success = _send(recipient, subject, _base_template("התראת מחיקת הזמנה", body)) and success
    return success


def send_missing_customer_email_alert(
    *,
    booking_id: int,
    customer_name: str,
    customer_phone: str | None,
    customer_id_num: str | None,
    car_name: str,
    start: str,
    end: str,
    actor_email: str,
    actor_role: str,
) -> bool:
    recipients = _parse_recipients(settings.SECURITY_ALERT_RECIPIENTS)
    if not recipients:
        logger.info("[ALERT EMAIL SKIPPED] No SECURITY_ALERT_RECIPIENTS configured")
        return False

    body = f"""
    <p><strong>התראת תפעול:</strong> נוצרה הזמנה חדשה ללא כתובת מייל ללקוח, לאחר סימון מפורש של המפעיל.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#fff7ed">
        <td style="padding:10px;font-weight:bold">מספר הזמנה</td>
        <td style="padding:10px">#{booking_id}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">לקוח</td>
        <td style="padding:10px">{customer_name}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">טלפון</td>
        <td style="padding:10px">{customer_phone or 'לא הוזן'}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">תעודת זהות</td>
        <td style="padding:10px">{customer_id_num or 'לא הוזן'}</td>
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
    <p style="color:#b45309;font-weight:bold">יש להשלים דרך התקשרות חלופית או לתעד חוסר במייל לפי הנוהל.</p>"""

    subject = f"[ALERT] Booking #{booking_id} created without customer email — {settings.APP_NAME}"
    success = True
    for recipient in recipients:
        success = _send(recipient, subject, _base_template("התראת חוסר מייל ללקוח", body)) and success
    return success


def send_past_booking_alert(
    *,
    booking_id: int,
    customer_name: str,
    car_name: str,
    start: str,
    end: str,
    pickup_time: str | None,
    hours_in_past: float,
    actor_email: str,
    actor_role: str,
) -> bool:
    recipients = _parse_recipients(settings.SECURITY_ALERT_RECIPIENTS)
    if not recipients:
        logger.info("[ALERT EMAIL SKIPPED] No SECURITY_ALERT_RECIPIENTS configured")
        return False

    pickup_str = f" {pickup_time}" if pickup_time else ""
    body = f"""
    <p><strong>התראת תפעול:</strong> נוצרה הזמנה חדשה שתאריך ההתחלה שלה עבר לפני יותר מ-5 שעות.</p>
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
        <td style="padding:10px">{start}{pickup_str}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">עד תאריך</td>
        <td style="padding:10px">{end}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">עיכוב רישום</td>
        <td style="padding:10px;color:#dc2626;font-weight:bold">{hours_in_past:.1f} שעות</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">בוצע ע"י</td>
        <td style="padding:10px">{actor_email} ({actor_role})</td>
      </tr>
    </table>
    <p style="color:#dc2626;font-weight:bold">ההזמנה נרשמה באיחור משמעותי — יש לוודא שהרכב אכן יצא בזמן ולתעד בהתאם.</p>"""

    subject = f"[ALERT] Booking #{booking_id} registered {hours_in_past:.1f}h after start — {settings.APP_NAME}"
    success = True
    for recipient in recipients:
        success = _send(recipient, subject, _base_template("התראת רישום הזמנה באיחור", body)) and success
    return success


def send_booking_edit_alert(
    *,
    booking_id: int,
    customer_name: str,
    actor_email: str,
    actor_role: str,
    created_by_name: str | None,
    changed_fields: list[str],
    operator_note: str | None = None,
) -> bool:
    if not settings.CROSS_AGENT_BOOKING_EDIT_ALERTS_ENABLED:
        logger.info("[ALERT EMAIL SKIPPED] CROSS_AGENT_BOOKING_EDIT_ALERTS_ENABLED is disabled")
        return False

    recipients = _parse_recipients(settings.SECURITY_ALERT_RECIPIENTS)
    if not recipients:
        logger.info("[ALERT EMAIL SKIPPED] No SECURITY_ALERT_RECIPIENTS configured")
        return False

    note_row = ""
    if operator_note:
        note_row = f"""
      <tr>
        <td style=\"padding:10px;font-weight:bold\">הערת מפעיל</td>
        <td style=\"padding:10px\">{operator_note}</td>
      </tr>"""

    body = f"""
    <p><strong>התראת בקרה:</strong> בוצעה עריכת הזמנה ע"י משתמש שאינו יוצר ההזמנה.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#fff7ed">
        <td style="padding:10px;font-weight:bold">מספר הזמנה</td>
        <td style="padding:10px">#{booking_id}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">לקוח</td>
        <td style="padding:10px">{customer_name}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">יוצר ההזמנה</td>
        <td style="padding:10px">{created_by_name or 'לא ידוע'}</td>
      </tr>
      <tr>
        <td style="padding:10px;font-weight:bold">נערך ע"י</td>
        <td style="padding:10px">{actor_email} ({actor_role})</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:10px;font-weight:bold">שדות ששונו</td>
        <td style="padding:10px">{', '.join(changed_fields) if changed_fields else 'לא זוהו שדות'}</td>
      </tr>
      {note_row}
    </table>
    <p style="color:#b45309;font-weight:bold">נדרשת אפשרות תחקור מלאה דרך audit log ומסך ההזמנות.</p>"""

    subject = f"[ALERT] Booking #{booking_id} edited by non-owner — {settings.APP_NAME}"
    success = True
    for recipient in recipients:
        success = _send(recipient, subject, _base_template("התראת עריכת הזמנה", body)) and success
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

