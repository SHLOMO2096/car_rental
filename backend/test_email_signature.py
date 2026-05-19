#!/usr/bin/env python3
"""
Email System Test & Verification Script

Usage:
    python test_email_signature.py              # Test signature generation
    python test_email_signature.py --send       # Test actual email sending
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

from app.core.signature import (
    SignatureConfig,
    get_business_signature,
    get_contact_link,
    get_logo_base64,
    get_logo_html,
)
from app.core.config import settings


def test_signature_config():
    """Test signature configuration"""
    print("=" * 60)
    print("📋 SIGNATURE CONFIGURATION TEST")
    print("=" * 60)
    
    print(f"Business Name: {SignatureConfig.BUSINESS_NAME}")
    print(f"Email: {SignatureConfig.CONTACT_EMAIL}")
    print(f"Phone: {SignatureConfig.CONTACT_PHONE}")
    print(f"Address: {SignatureConfig.ADDRESS}")
    print(f"Hours (Sun-Thu): {SignatureConfig.BUSINESS_HOURS['sun_thu']}")
    print(f"Hours (Friday): {SignatureConfig.BUSINESS_HOURS['friday']}")
    print(f"Brand Color: {SignatureConfig.BRAND_COLOR_PRIMARY}")
    print()


def test_logo_loading():
    """Test logo loading"""
    print("=" * 60)
    print("🖼️  LOGO LOADING TEST")
    print("=" * 60)
    
    logo_b64 = get_logo_base64()
    if logo_b64:
        print(f"✅ Logo found and encoded!")
        print(f"   Base64 size: {len(logo_b64)} bytes")
        print(f"   First 50 chars: {logo_b64[:50]}...")
    else:
        print("❌ Logo not found (signature will work without logo)")
    print()


def test_contact_links():
    """Test contact link generation"""
    print("=" * 60)
    print("🔗 CONTACT LINKS TEST")
    print("=" * 60)
    
    phone_link = get_contact_link("phone")
    email_link = get_contact_link("email")
    whatsapp_link = get_contact_link("whatsapp")
    
    print("Phone Link:")
    print(f"  {phone_link}")
    print()
    
    print("Email Link:")
    print(f"  {email_link}")
    print()
    
    print("WhatsApp Link:")
    print(f"  {whatsapp_link}")
    print()


def test_signature_generation():
    """Test signature HTML generation"""
    print("=" * 60)
    print("✉️  SIGNATURE GENERATION TEST")
    print("=" * 60)
    
    signature = get_business_signature(include_logo=True)
    print("Signature HTML (first 500 chars):")
    print("-" * 60)
    print(signature[:500] + "..." if len(signature) > 500 else signature)
    print("-" * 60)
    print(f"Total HTML size: {len(signature)} bytes")
    print()


def test_email_config():
    """Test email configuration from settings"""
    print("=" * 60)
    print("📧 EMAIL CONFIGURATION TEST")
    print("=" * 60)
    
    print(f"EMAILS_ENABLED: {settings.EMAILS_ENABLED}")
    print(f"SMTP_HOST: {settings.SMTP_HOST or '(not set)'}")
    print(f"SMTP_PORT: {settings.SMTP_PORT}")
    print(f"SMTP_USER: {settings.SMTP_USER or '(not set)'}")
    print(f"EMAILS_FROM: {settings.EMAILS_FROM}")
    print(f"EMAILS_FROM_NAME: {settings.EMAILS_FROM_NAME}")
    print(f"SECURITY_ALERT_RECIPIENTS: {settings.SECURITY_ALERT_RECIPIENTS or '(not set)'}")
    print()


def test_email_send():
    """Test actual email sending"""
    print("=" * 60)
    print("📨 EMAIL SENDING TEST")
    print("=" * 60)
    
    if not settings.EMAILS_ENABLED:
        print("⚠️  EMAILS_ENABLED is False")
        print("   To test email sending, set EMAILS_ENABLED=true in .env")
        print()
        return
    
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print("❌ Missing SMTP configuration")
        print("   Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD")
        print()
        return
    
    from app.core.email import _send
    
    test_html = """
    <div dir="rtl" style="font-family:Arial,sans-serif">
        <p>זהו בדיקה אוטומטית של מערכת הדוא"ל.</p>
        <p>אם קיבלת הודעה זו, המערכת פועלת כראוי! ✅</p>
    </div>
    """
    
    print(f"Attempting to send test email to: {SignatureConfig.CONTACT_EMAIL}")
    
    try:
        result = _send(
            to=SignatureConfig.CONTACT_EMAIL,
            subject="🚘 בדיקת מערכת דוא״ל — WayCar",
            html=test_html
        )
        if result:
            print("✅ Email sent successfully!")
        else:
            print("❌ Failed to send email (check logs)")
    except Exception as e:
        print(f"❌ Error: {e}")
    print()


def main():
    """Run all tests"""
    print("\n")
    print("╭" + "─" * 58 + "╮")
    print("│" + " 🚘 WayCar Email System Test & Verification ".center(58) + "│")
    print("╰" + "─" * 58 + "╯")
    print()
    
    test_signature_config()
    test_logo_loading()
    test_contact_links()
    test_signature_generation()
    test_email_config()
    
    # Only test sending if --send flag is provided
    if "--send" in sys.argv:
        test_email_send()
    else:
        print("=" * 60)
        print("💡 TO TEST EMAIL SENDING")
        print("=" * 60)
        print("Run: python test_email_signature.py --send")
        print()
    
    print("=" * 60)
    print("✅ TESTS COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()

