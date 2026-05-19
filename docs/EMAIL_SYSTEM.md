## 📧 Email System & Professional Signature

### Overview

The car rental system now includes a professional email signature with business contact details, logo, and business hours. All outgoing emails automatically include this signature.

### Configuration

All email signature details are defined in `app/core/signature.py`:

```python
class SignatureConfig:
    BUSINESS_NAME = "WayCar"
    CONTACT_EMAIL = "way85899@gmail.com"
    CONTACT_PHONE = "0583285899"
    ADDRESS = "אבני נזר 46, מודיעין עילית"
    
    BUSINESS_HOURS = {
        "sun_thu": "08:00 - 17:00",  # Sunday to Thursday
        "friday": "08:00 - 12:00"     # Friday
    }
```

#### To update signature details:

1. Edit `backend/app/core/signature.py`
2. Update the `SignatureConfig` class attributes
3. No restart needed (changes apply on next email send)

### Features

✅ **Professional Signature** - Includes:
- Company logo (embedded as base64)
- Business name
- Clickable phone link (tel:)
- Clickable email link (mailto:)
- Physical address
- Business hours
- Copyright notice

✅ **Smart Logo Loading**:
- Automatically looks for logo files in multiple locations
- Supports both Hebrew (לוגו.jpg) and English (logo.jpg, logo.png)
- Graceful fallback if logo not found
- Cached as base64 for performance

✅ **RTL Support**:
- All emails are right-to-left for Hebrew
- Proper text alignment
- Professional layout

### Email Template Structure

Every email sent includes:
1. **Header** - App name with car emoji 🚘
2. **Body** - Email-specific content
3. **Signature** - Professional business details
4. **Footer** - "Sent automatically" note

### Usage

The signature is automatically included in all emails. No additional code needed.

All email sending functions in `app.core.email`:
- `send_booking_confirmation()`
- `send_booking_cancellation()`
- `send_booking_reminder()`
- `send_customer_message()`
- `send_booking_delete_alert()`
- `send_missing_customer_email_alert()`
- `send_booking_edit_alert()`
- `send_reassignment_apply_alert()`

### Customization

#### Hide logo in specific emails:

```python
from app.core.signature import get_business_signature

# Get signature without logo
signature_no_logo = get_business_signature(include_logo=False)
```

#### Just get the contact link:

```python
from app.core.signature import get_contact_link

phone_link = get_contact_link("phone")      # Clickable phone
email_link = get_contact_link("email")      # Clickable email
whatsapp_link = get_contact_link("whatsapp") # WhatsApp link
```

### Logo Management

**Logo Location:**
- Original: `C:\Users\shlomo\PycharmProjects\car_rental\לוגו.jpg`
- Frontend: `frontend/public/logo.jpg`

**Supported formats:**
- JPEG (.jpg)
- PNG (.png)

**To change the logo:**
1. Replace `לוגו.jpg` in the project root
2. Or copy new logo to `frontend/public/logo.jpg`
3. The backend will automatically find and embed it

### Color Scheme

The signature uses your brand colors:

```python
BRAND_COLOR_PRIMARY = "#0084C7"  # Logo blue (used for links and headings)
BRAND_COLOR_DARK = "#1e3a5f"     # Dark header background
BRAND_COLOR_LIGHT = "#f1f5f9"    # Light backgrounds
```

### Email Configuration in `.env`

Required environment variables:

```bash
# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=way85899@gmail.com
SMTP_PASSWORD=your_app_password
EMAILS_FROM=way85899@gmail.com
EMAILS_FROM_NAME=WayCar
EMAILS_ENABLED=true

# Security Alerts
SECURITY_ALERT_RECIPIENTS=admin@example.com,manager@example.com
CROSS_AGENT_BOOKING_EDIT_ALERTS_ENABLED=true
```

### Testing Email Signature

To test emails locally without sending:

```python
# Emails will be logged instead of sent
EMAILS_ENABLED=false
```

Example output:
```
[EMAIL DISABLED] To: customer@example.com | Subject: אישור הזמנה #123
```

To actually send emails:
```python
EMAILS_ENABLED=true
```

### Mobile Responsiveness

The signature is fully responsive:
- Logo scales on mobile devices
- Links are clickable and mobile-friendly
- Text remains readable on all screen sizes

### Troubleshooting

#### Logo not appearing in emails:

1. Check logo file exists in project root or `frontend/public/`
2. Verify it's a valid JPEG or PNG file
3. Check backend logs for warnings about logo loading
4. The system will function normally without logo (just no image)

#### Email not sending:

1. Verify `EMAILS_ENABLED=true` in `.env`
2. Check SMTP credentials in `.env`
3. Verify gmail app password (not regular password for Gmail)
4. Check `SMTP_HOST` and `SMTP_PORT` settings
5. Verify firewall allows outgoing SMTP (port 587)

#### Special characters not displaying:

- All emails use UTF-8 encoding
- Browser/email client must support UTF-8
- Special Hebrew characters should display correctly

### Files Modified/Created

- ✅ Created: `backend/app/core/signature.py` - Signature configuration and generation
- ✅ Modified: `backend/app/core/email.py` - Now includes signature in all emails
- ✅ Copied: `frontend/public/logo.jpg` - Brand logo for UI
- ✅ Created: `docs/EMAIL_SYSTEM.md` - This documentation

### Future Enhancements

Possible improvements:
- [ ] HTML email templates with preview text
- [ ] Dynamic signature based on user role
- [ ] Email campaign tracking
- [ ] Unsubscribe management
- [ ] PDF invoice attachments
- [ ] SMS integration

