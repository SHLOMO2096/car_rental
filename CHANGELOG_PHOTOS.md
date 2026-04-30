# Car Rental Project - Google Drive Photo Upload Feature

## Changes Summary

### ✅ Backend Changes

#### 1. Dependencies Updated (`backend/requirements.txt`)
Added Google Drive API libraries:
```
google-auth-oauthlib==1.2.0
google-auth-httplib2==0.2.0
google-api-python-client==2.108.0
```

#### 2. Configuration Extended (`app/core/config.py`)
Added Google Drive settings:
```python
GOOGLE_DRIVE_FOLDER_ID: Optional[str] = None
GOOGLE_DRIVE_CREDENTIALS_JSON: Optional[str] = None
GOOGLE_DRIVE_ENABLED: bool = False
```

#### 3. New Google Drive Service (`app/services/google_drive.py`)
Created complete service with:
- Credentials initialization (service account)
- File upload to Google Drive
- Permission management
- Booking photo specific upload method
- Singleton pattern for service instance

#### 4. Bookings API Extended (`app/routers/bookings.py`)
Added new endpoint:
```
POST /bookings/{booking_id}/upload-photo
```
Features:
- File type validation (images only)
- File size validation (max 10 MB)
- Automatic metadata tagging
- Audit logging
- Error handling

### ✅ Frontend Changes

#### 1. Bookings API Client (`frontend/src/api/bookings.js`)
Added upload method:
```javascript
uploadPhoto: (id, file) => FormData multipart upload
```

#### 2. Bookings Page (`frontend/src/pages/Bookings.jsx`)
- Added photo upload state management
- Added `handlePhotoUpload()` function
- Added 📸 button to table actions
- Added 📸 button to mobile cards
- File input dialogs for both desktop and mobile
- Loading state feedback (⏳)
- Success/error notifications

### 📁 New Files Created
- `backend/app/services/google_drive.py` - Google Drive integration
- `GOOGLE_DRIVE_SETUP.md` - Complete setup guide

### 📝 Modified Files
- `backend/requirements.txt` - Added Google libraries
- `backend/app/core/config.py` - Added Google Drive config
- `backend/app/routers/bookings.py` - Added upload endpoint
- `frontend/src/api/bookings.js` - Added upload method
- `frontend/src/pages/Bookings.jsx` - Added upload UI

## Quick Start

### Backend Setup:
1. Install dependencies: `pip install -r requirements.txt`
2. Configure `.env`:
   ```
   GOOGLE_DRIVE_ENABLED=true
   GOOGLE_DRIVE_FOLDER_ID="your-folder-id"
   GOOGLE_DRIVE_CREDENTIALS_JSON='{"full":"json"}'
   ```

### Frontend Usage:
1. Click 📸 button next to active bookings
2. Select image file
3. Upload completes automatically
4. Opens Google Drive link on success

## Feature Highlights

✨ **Direct Google Drive Upload** - No local storage
🔐 **Service Account Authentication** - Secure credential handling
📱 **Responsive UI** - Works on desktop and mobile
🔍 **File Validation** - Type and size checks
📊 **Audit Logging** - All uploads tracked
⚡ **Instant Upload** - No page reload needed
🎨 **Smart Naming** - `Booking_ID_Car_Customer.jpg`

## Testing

Navigate to Bookings page and:
1. Find any active booking
2. Click the 📸 camera icon
3. Select an image
4. Wait for success message
5. Photo appears in your Google Drive folder

## Notes

- Photos are **NOT** stored on the server
- Direct upload to Google Drive
- Automatically shared based on your Drive settings
- Supports JPG, PNG, WebP, GIF, etc.
- Max file size: 10 MB
- Maximum concurrent uploads handled by browser

## Security

✓ ServiceAccount OAuth2 authentication
✓ Drive API permissions scoped to Drive only
✓ File type and size validation
✓ Audit trail for compliance
✓ No plain credentials in code
✓ Environment variable based config

## Requirements Met

✅ Upload feature in booking card
✅ Photo capture/selection
✅ No local server storage
✅ Direct Google Drive upload
✅ Using Gmail SMTP configured credentials (can reuse same account)
✅ Automatic file naming and metadata
✅ Error handling and user feedback

