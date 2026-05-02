# ══════════════════════════════════════════════════════════════════════════════
import logging
import io
import json
import base64
import tempfile
from pathlib import Path
from typing import Optional
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials as SACredentials
from google.oauth2.credentials import Credentials as OAuthCredentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from app.core.config import settings

logger = logging.getLogger(__name__)

GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]


class GoogleDriveService:
    def __init__(self):
        self.service = None
        self.credentials = None
        self._init_credentials()

    def _init_credentials(self):
        """Initialize Google Drive credentials from config"""
        if not settings.GOOGLE_DRIVE_ENABLED or not settings.GOOGLE_DRIVE_CREDENTIALS_JSON:
            logger.info("Google Drive is disabled")
            return

        try:
            creds_content = settings.GOOGLE_DRIVE_CREDENTIALS_JSON
            
            # Try to decode if base64
            if creds_content.startswith("{") is False:
                try:
                    # Fix base64 padding if missing
                    padding_needed = len(creds_content) % 4
                    if padding_needed:
                        creds_content += "=" * (4 - padding_needed)
                        
                    creds_content = base64.b64decode(creds_content).decode("utf-8")
                except Exception as e:
                    logger.error(f"Base64 decode failed: {e}")
            
            # Parse JSON
            creds_dict = json.loads(creds_content)
            
            # Create credentials based on type
            if "refresh_token" in creds_dict:
                self.credentials = OAuthCredentials.from_authorized_user_info(
                    creds_dict,
                    scopes=GOOGLE_DRIVE_SCOPES
                )
            else:
                self.credentials = SACredentials.from_service_account_info(
                    creds_dict,
                    scopes=GOOGLE_DRIVE_SCOPES
                )
            
            # Build service
            self.service = build("drive", "v3", credentials=self.credentials)
            logger.info("✓ Google Drive service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Drive: {e}")
            self.service = None
            self.credentials = None

    def is_available(self) -> bool:
        """Check if Google Drive service is available"""
        return self.service is not None

    def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        parents: Optional[list[str]] = None,
        description: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Upload a file to Google Drive
        
        Args:
            file_bytes: File content as bytes
            filename: Name of the file
            parents: List of parent folder IDs
            description: Optional description
            
        Returns:
            File metadata dict with 'id' and 'webViewLink', or None on failure
        """
        if not self.is_available():
            logger.error("Google Drive service is not available")
            return None

        try:
            if parents is None:
                if settings.GOOGLE_DRIVE_FOLDER_ID:
                    parents = [settings.GOOGLE_DRIVE_FOLDER_ID]
                else:
                    parents = ["root"]

            file_metadata = {
                "name": filename,
                "parents": parents,
            }
            if description:
                file_metadata["description"] = description

            file_stream = io.BytesIO(file_bytes)
            media = MediaIoBaseUpload(file_stream, mimetype="image/jpeg", resumable=True)

            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id,webViewLink,name,createdTime",
                supportsAllDrives=True,
            ).execute()

            logger.info(f"✓ File uploaded to Google Drive: {filename} (ID: {file.get('id')})")
            
            # Make file viewable by all (optional - can be controlled by config)
            try:
                self.service.permissions().create(
                    fileId=file.get("id"),
                    body={
                        "kind": "drive#permission",
                        "type": "anyone",
                        "role": "viewer",
                    },
                    supportsAllDrives=True,
                ).execute()
            except Exception as e:
                logger.warning(f"Could not set permissions on Drive file: {e}")

            return {
                "id": file.get("id"),
                "name": file.get("name"),
                "link": file.get("webViewLink"),
                "created_at": file.get("createdTime"),
            }
        except Exception as e:
            logger.error(f"Failed to upload file to Google Drive: {e}")
            return None

    def upload_booking_photo(
        self,
        file_bytes: bytes,
        booking_id: int,
        car_name: str,
        customer_name: str,
    ) -> Optional[dict]:
        """
        Upload a booking car photo to Google Drive with metadata
        
        Args:
            file_bytes: Image file as bytes
            booking_id: Booking ID
            car_name: Car name/model
            customer_name: Customer name
            
        Returns:
            File metadata dict or None
        """
        filename = f"Booking_{booking_id}_{car_name}_{customer_name}.jpg"
        description = f"Booking #{booking_id}: {customer_name} - {car_name}"
        
        return self.upload_file(file_bytes, filename, description=description)


# Global instance
_drive_service = None


def get_drive_service() -> GoogleDriveService:
    """Get singleton Google Drive service instance"""
    global _drive_service
    if _drive_service is None:
        _drive_service = GoogleDriveService()
    return _drive_service

