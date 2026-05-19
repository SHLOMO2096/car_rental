# 📧 Gmail Setup Guide for WayCar

This guide helps you set up email functionality using Gmail SMTP servers.

## Quick Setup (5 minutes)

### Step 1: Enable 2-Step Verification (Gmail Security)

1. Go to [account.google.com](https://account.google.com)
2. Click **Security** in the left menu
3. Scroll to **How you sign in to Google**
4. Click **2-Step Verification**
5. Follow the steps to enable 2-Step Verification
   - You'll need your phone to receive a verification code

### Step 2: Create an App Password

1. Go back to [account.google.com/security](https://account.google.com/security)
2. Scroll to **How you sign in to Google** section
3. Click **App passwords** (appears only after 2-Step Verification is enabled)
4. Select:
   - App: **Mail**
   - Device: **Windows Computer** (or your device type)
5. Click **Generate**
6. Google will show you a 16-character password
7. **Copy this password** (you'll need it in the next step)

### Step 3: Configure Environment Variables

Edit `backend/.env`:

```bash
# Email Configuration
EMAILS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=way85899@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # 16-char password from Step 2
EMAILS_FROM=way85899@gmail.com
EMAILS_FROM_NAME=WayCar

# Security Alerts (optional)
SECURITY_ALERT_RECIPIENTS=admin@example.com,manager@example.com
```

### Step 4: Test Email Configuration

```bash
cd backend
python test_email_signature.py        # Test configuration
python test_email_signature.py --send # Send test email
```

Expected output:
```
✅ SIGNATURE CONFIGURATION TEST passed
✅ LOGO LOADING TEST passed
✅ CONTACT LINKS TEST passed
✅ EMAIL SENDING TEST passed
```

## Complete Step-by-Step Process

### Creating App Password - Detailed Steps

1. **Log in to Gmail Account**
   - Email: `way85899@gmail.com`
   - Your regular Gmail password

2. **Navigate to Security Settings**
   - URL: `https://account.google.com/security`
   - Or: Gmail Account → Manage your Account → Security tab

3. **Check: 2-Step Verification Status**
   ```
   Location: Security page → "How you sign in to Google" section
   ```
   - ✅ Enabled = Continue to next step
   - ❌ Disabled = Enable first (see below)

4. **Enable 2-Step Verification (if needed)**
   - Click "2-Step Verification"
   - Click "Get Started"
   - Choose verification method (phone SMS recommended)
   - Verify with code
   - Done!

5. **Generate App Password**
   - Back to Security page
   - Scroll to "How you sign in to Google"
   - Click "App passwords"
   - Select Device: Windows Computer
   - Select App: Mail
   - Click "Generate"
   - **Important:** Copy the 16-character password shown
     ```
     xxxx xxxx xxxx xxxx
     ```

6. **Update `.env` File**
   ```bash
   EMAILS_ENABLED=true
   SMTP_USER=way85899@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # Paste from Step 5
   ```

## Configuration Reference

| Setting | Value | Notes |
|---------|-------|-------|
| EMAILS_ENABLED | true/false | Enable/disable email sending |
| SMTP_HOST | smtp.gmail.com | Gmail's SMTP server |
| SMTP_PORT | 587 | Standard SMTP port (TLS) |
| SMTP_USER | your@gmail.com | Gmail email address |
| SMTP_PASSWORD | xxxx xxxx... | 16-char app password |
| EMAILS_FROM | your@gmail.com | Sender email |
| EMAILS_FROM_NAME | WayCar | Display name in emails |
| SECURITY_ALERT_RECIPIENTS | email@example.com | Comma-separated admin emails |

## Testing

### Test 1: Check Configuration

```bash
cd backend
python test_email_signature.py
```

Checks:
- ✅ Signature configuration loaded
- ✅ Logo found
- ✅ Contact links generated
- ✅ Email config from .env

### Test 2: Send Test Email

```bash
cd backend
python test_email_signature.py --send
```

Sends a test email to `CONTACT_EMAIL` with professional signature.

Expected result:
- Email arrives with:
  - WayCar logo
  - Professional signature
  - Business contact details
  - Business hours

### Test 3: Integration Test

Send a real booking confirmation:

```bash
# Use the API to create a booking
# Or trigger from the UI
# Email should include full professional signature
```

## Troubleshooting

### ❌ "Authentication failed" error

**Solution:**
```
1. Verify SMTP_USER matches Gmail address
2. Check SMTP_PASSWORD is correct (16-char app password, not Gmail password)
3. Verify 2-Step Verification is enabled
4. Try resetting app password (create new one)
```

### ❌ "Could not connect to server" error

**Solution:**
```
1. Verify SMTP_HOST=smtp.gmail.com
2. Verify SMTP_PORT=587 (not 465)
3. Check firewall allows outgoing port 587
4. Try from command line:
   telnet smtp.gmail.com 587
```

### ❌ Email not arriving

**Solution:**
```
1. Check EMAILS_ENABLED=true
2. Check logs for error messages
3. Verify recipient email is correct
4. Check spam/junk folder
5. Verify EMAILS_FROM is correct
```

### ❌ App Password option not showing

**Solution:**
```
1. 2-Step Verification must be ENABLED first
2. Wait a few minutes after enabling 2-Step
3. Log out and log back in to Gmail
4. Try in incognito window
5. If still missing, your account type may not support app passwords
```

## Alternative Email Services

### SendGrid

Replace in `.env`:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxx...  # Your SendGrid API key
```

### Office 365

Replace in `.env`:
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your@company.com
SMTP_PASSWORD=your_password
```

### Mailgun

Replace in `.env`:
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASSWORD=your_mailgun_password
```

## Security Best Practices

1. **Never commit `.env` to Git**
   ```bash
   # .gitignore should have:
   backend/.env
   ```

2. **Use App Passwords, not main password**
   - App passwords are more secure
   - Can be revoked individually
   - Limited to email app only

3. **Rotate passwords periodically**
   - Create new app password monthly
   - Delete old one after updating

4. **Restrict email recipients**
   - Only send to verified addresses
   - Use `SECURITY_ALERT_RECIPIENTS` carefully

5. **Enable 2-Step Verification** on the Gmail account

## Environment Setup Examples

### Development (Gmail)
```bash
EMAILS_ENABLED=false  # Don't send real emails during dev
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=dev@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Production (Gmail)
```bash
EMAILS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=way85899@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
EMAILS_FROM=way85899@gmail.com
EMAILS_FROM_NAME=WayCar
SECURITY_ALERT_RECIPIENTS=admin@company.com,manager@company.com
```

### Staging (SendGrid)
```bash
EMAILS_ENABLED=true
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxx
```

## Email Signature Preview

All emails will include:

```
═══════════════════════════════════════════════════════════

               🚘 השכרת רכבים

[Email Signature with Logo]
═══════════════════════════════════════════════════════════

WayCar

טלפון: 0583285899
מייל: way85899@gmail.com
כתובת: אבני נזר 46, מודיעין עילית

שעות פעילות:
א׳-ה׳: 08:00 - 17:00
ו׳: 08:00 - 12:00

© WayCar - כל הזכויות שמורות

════════════════════════════════════════════���══════════════
```

## Contact Support

If you need help:
1. Check logs: `docker-compose logs -f backend`
2. Verify configuration: `python test_email_signature.py`
3. Check `.env` syntax
4. Verify Gmail App Password is correct

## Files to Review

- Email configuration: `backend/app/core/signature.py`
- Email templates: `backend/app/core/email.py`
- Test script: `backend/test_email_signature.py`
- Environment template: `backend/.env.example`

