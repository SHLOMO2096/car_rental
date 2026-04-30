# Google Drive Car Photo Integration - Setup Guide

## Overview
This feature allows uploading car photos for bookings directly to Google Drive without storing them locally on the server.

## Backend Setup

### 1. Google Cloud Configuration

#### Create a Service Account:
1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a new project (e.g., "Car Rental App")
3. Enable Google Drive API:
   - Go to APIs & Services > Library
   - Search for "Google Drive API"
   - Click "Enable"

4. Create Service Account:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and click "Create"
   - In the key section, click "Add Key" > "Create new key" > "JSON"
   - Download the JSON file - this is your credentials

#### Create/Share Google Drive Folder:
1. In Google Drive, create a folder (e.g., "car-rental-photos")
2. Right-click on the folder > "Share"
3. Share it with the service account email (found in the JSON file as `client_email`)
4. Get the folder ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`

### 2. Environment Configuration

Add these variables to your `.env` file:

\`\`\`bash
# Google Drive Integration
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_FOLDER_ID="your-folder-id-here"
GOOGLE_DRIVE_CREDENTIALS_JSON='{"type":"service_account",...}'  # Paste entire JSON or base64 encode it
\`\`\`

**Note**: The credentials JSON can be either:
- Raw JSON string (entire JSON file content)
- Base64 encoded JSON string

### 3. Backend File Structure
- `/app/services/google_drive.py` - Google Drive service with upload functionality
- `/app/routers/bookings.py` - Extended with `/bookings/{booking_id}/upload-photo` endpoint

## Frontend Usage

### UI Components
The upload feature is integrated into the Bookings page:

**Desktop View (Table)**:
- 📸 button appears in the action column for active bookings
- Click to select and upload an image file
- Shows ⏳ while uploading

**Mobile View (Cards)**:
- 📸 button appears in the footer of each active booking card
- Same functionality as desktop

### API Integration
File: `frontend/src/api/bookings.js`

```javascript
// Method signature
bookingsAPI.uploadPhoto(bookingId, file)

// Usage example
const file = event.target.files[0];
const result = await bookingsAPI.uploadPhoto(bookingId, file);
// result = { success, file_id, link, created_at, ... }
```

## Usage Flow

1. **Navigate to Bookings page**
   - Open the Bookings section in the admin panel

2. **Find Active Booking**
   - Locate an active (פעיל) booking

3. **Upload Photo**
   - Click the 📸 button
   - Select an image file from your device
   - Wait for upload confirmation

4. **View in Google Drive**
   - After upload, a link opens to Google Drive
   - File is named: `Booking_{ID}_{CarName}_{CustomerName}.jpg`
   - Automatically shared with configured permissions

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "שירות Google Drive אינו זמין" | Google Drive not configured | Check `.env` settings and credentials |
| "קובץ חייב להיות תמונה" | Wrong file type | Select only image files (jpg, png, etc.) |
| "הקובץ גדול מדי" | File > 10 MB | Compress the image |
| "הקובץ ריק" | Empty file selected | Select a valid image file |

## Configuration

### Optional Settings (in `/app/core/config.py`):

```python
# Current default: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024

# File naming pattern
filename = f"Booking_{booking_id}_{car_name}_{customer_name}.jpg"

# Permissions: Currently set to "viewer" (read-only)
# Can be modified in /app/services/google_drive.py:upload_file()
```

## Security Notes

✓ Service account credentials stored securely in `.env`
✓ File permissions managed via Google Drive sharing
✓ Files automatically marked as viewable (can be changed)
✓ Audit logging enabled for all uploads
✓ File size validation (max 10 MB)
✓ File type validation (images only)

## Troubleshooting

### Credentials Not Found
```
Error: Failed to initialize Google Drive: ...
```
**Solution**: Ensure `GOOGLE_DRIVE_CREDENTIALS_JSON` is properly formatted JSON or valid base64

### Permission Denied
```
Error: <HttpError 403>
```
**Solution**: Share the Google Drive folder with the service account email

### Folder Not Found
```
Error: Invalid Folder ID
```
**Solution**: Get the correct folder ID from the Google Drive URL share link

## Testing

### Manual Test:
1. Create a test booking
2. Upload a test image
3. Verify file appears in Google Drive folder
4. Check audit logs for upload event

### Debug Mode:
Enable logging in `/app/services/google_drive.py`:
```python
# Look for "Google Drive service initialized successfully" message
# Look for "File uploaded to Google Drive:" messages
```

## API Endpoint Documentation

### Upload Booking Photo
**Endpoint**: `POST /bookings/{booking_id}/upload-photo`

**Request**:
- Content-Type: multipart/form-data
- Form field: `file` (binary image data)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "הקובץ הועלה בהצלחה",
  "file_id": "google-drive-file-id",
  "file_name": "Booking_123_Tesla_ModelS_John_Doe.jpg",
  "link": "https://drive.google.com/file/d/.../view",
  "created_at": "2024-04-30T14:22:00Z"
}
```

**Errors**:
- 400: Invalid file type or empty file
- 404: Booking not found
- 503: Google Drive service unavailable
- 500: Upload failed

## Future Improvements

- [ ] Drag & drop photo upload
- [ ] Multiple photos per booking
- [ ] Photo gallery view
- [ ] Configurable file naming
- [ ] Automatic image compression
- [ ] OCR for vehicle info extraction

