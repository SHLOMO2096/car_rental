"""
Email signature and business contact information
"""

from typing import Optional
import base64
import os
from functools import lru_cache

class SignatureConfig:
    """Business contact details for email signatures"""
    
    BUSINESS_NAME = "וואי קאר"
    BRAND_HEADING = "וואי קאר השכרת רכב"
    CONTACT_EMAIL = "way85899@gmail.com"
    CONTACT_PHONE = "0583285899"
    ADDRESS = "אבני נזר 46, מודיעין עילית"
    
    # Business hours
    BUSINESS_HOURS = {
        "sun_thu": "08:00 - 17:00",  # Sunday to Thursday
        "friday": "08:00 - 12:00"     # Friday
    }
    
    # Brand colors
    BRAND_COLOR_PRIMARY = "#0084C7"  # Logo blue
    BRAND_COLOR_DARK = "#1e3a5f"     # Dark header
    BRAND_COLOR_LIGHT = "#f1f5f9"    # Light background
    
    WHATSAPP_URL_TEMPLATE = "https://wa.me/972{phone}?text={message}"
    
    # Primary logo candidates (backend runtime first, then project root)
    LOGO_FILE_CANDIDATES = [
        "logo.jpg",
        "logo.png",
        "לוגו.jpg",
    ]


@lru_cache(maxsize=1)
def get_logo_base64() -> Optional[str]:
    """
    Get the logo file encoded as base64
    Returns None if logo file not found
    """
    try:
        logo_bytes = get_logo_bytes()
        if logo_bytes:
            return base64.b64encode(logo_bytes).decode("utf-8")
    except Exception as e:
        import logging
        logging.warning(f"Could not load logo: {e}")
    
    return None


@lru_cache(maxsize=1)
def get_logo_bytes() -> Optional[bytes]:
    """Load logo bytes from common backend/project locations."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.abspath(os.path.join(current_dir, "../.."))
    project_root = os.path.abspath(os.path.join(current_dir, "../../.."))

    search_roots = [
        backend_root,
        project_root,
        "/app",
    ]

    for root in search_roots:
        for filename in SignatureConfig.LOGO_FILE_CANDIDATES:
            path = os.path.join(root, filename)
            if os.path.exists(path):
                with open(path, "rb") as f:
                    return f.read()

    return None


def get_logo_html(width: int = 150, height: str = "auto") -> str:
    """
    Get HTML img tag with base64-embedded logo
    
    Args:
        width: Width in pixels
        height: Height (can be 'auto', 'inherit', or pixel value)
    
    Returns:
        HTML img tag or empty string if logo not available
    """
    # CID works in major email clients better than data-uri in <img src="...">.
    if not get_logo_bytes():
        return ""

    return f'''
    <img 
        src="cid:waycar-logo"
        alt="{SignatureConfig.BUSINESS_NAME} Logo" 
        style="width:{width}px;height:{height};max-width:100%;margin:0 auto;display:block"
    />
    '''


def get_business_signature(include_logo: bool = True) -> str:
    """
    Generate a professional HTML email signature with business details
    
    Args:
        include_logo: Whether to include the logo (base64 embedded)
    
    Returns:
        HTML string with the signature
    """
    logo_html = ""
    if include_logo:
        logo_html = f"""
        <div style="text-align:center;margin:0 0 8px 0">
            {get_logo_html(width=170)}
        </div>"""
    
    hours_text = f"""
    <tr style="font-size:12px">
        <td style="padding:2px 0;color:#666">
            <strong>שעות פעילות:</strong> א׳-ה׳: {SignatureConfig.BUSINESS_HOURS['sun_thu']} | ו׳: {SignatureConfig.BUSINESS_HOURS['friday']}
        </td>
    </tr>"""
    
    signature = f"""
    <div style="border-top:2px solid {SignatureConfig.BRAND_COLOR_PRIMARY};padding:12px 0 0 0;margin-top:18px;font-family:Arial,sans-serif;direction:rtl;text-align:right;font-size:13px;color:#333">
        {logo_html}
        <table style="width:100%;border-collapse:collapse;text-align:right">
            <tr style="font-size:12px">
                <td style="padding:2px 0;color:#666">
                    <strong>טלפון:</strong> 
                    <a href="tel:{SignatureConfig.CONTACT_PHONE}" style="color:{SignatureConfig.BRAND_COLOR_PRIMARY};text-decoration:none">
                        {SignatureConfig.CONTACT_PHONE}
                    </a>
                </td>
            </tr>
            <tr style="font-size:12px">
                <td style="padding:2px 0;color:#666">
                    <strong>מייל:</strong> 
                    <a href="mailto:{SignatureConfig.CONTACT_EMAIL}" style="color:{SignatureConfig.BRAND_COLOR_PRIMARY};text-decoration:none">
                        {SignatureConfig.CONTACT_EMAIL}
                    </a>
                </td>
            </tr>
            <tr style="font-size:12px">
                <td style="padding:2px 0;color:#666">
                    <strong>כתובת:</strong> {SignatureConfig.ADDRESS}
                </td>
            </tr>
            {hours_text}
            <tr style="font-size:11px;color:#999">
                <td style="padding:6px 0">
                    {SignatureConfig.BRAND_HEADING}
                </td>
            </tr>
        </table>
    </div>
    """
    
    return signature


def get_contact_link(contact_type: str = "phone") -> str:
    """
    Get formatted contact link (phone or email)
    
    Args:
        contact_type: 'phone', 'email', or 'whatsapp'
    
    Returns:
        HTML anchor tag
    """
    if contact_type == "phone":
        return f'<a href="tel:{SignatureConfig.CONTACT_PHONE}" style="color:{SignatureConfig.BRAND_COLOR_PRIMARY};text-decoration:none">{SignatureConfig.CONTACT_PHONE}</a>'
    elif contact_type == "email":
        return f'<a href="mailto:{SignatureConfig.CONTACT_EMAIL}" style="color:{SignatureConfig.BRAND_COLOR_PRIMARY};text-decoration:none">{SignatureConfig.CONTACT_EMAIL}</a>'
    elif contact_type == "whatsapp":
        # Remove leading 0 and add country code for WhatsApp
        phone_clean = SignatureConfig.CONTACT_PHONE.lstrip('0')
        whatsapp_url = f"https://wa.me/972{phone_clean}"
        return f'<a href="{whatsapp_url}" style="color:{SignatureConfig.BRAND_COLOR_PRIMARY};text-decoration:none">WhatsApp</a>'
    
    return ""

