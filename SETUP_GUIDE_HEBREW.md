# צילום רכבים ל-Google Drive - מדריך שימוש

## 🚀 התחלה מהירה

### על המערכת
תכונה זו מאפשרת העלאת צילומי רכב עבור הזמנות ישירות ל-Google Drive בלי לשמור אותם בשרת המקומי.

### דרישות
- חשבון Google Cloud עם Google Drive API מופעל
- Service Account מכון עם credentials JSON
- תיקייה ב-Google Drive משותפת עם ה-Service Account

---

## 📋 שלבי Setup

### 1. יצירת Service Account ב-Google Cloud

```
1. Register/Login ל-Google Cloud Console
   https://console.cloud.google.com/

2. Create New Project:
   - Click "Select a Project" → "NEW PROJECT"
   - Name it: "car-rental-app"

3. Enable Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. Create Service Account:
   - APIs & Services > Credentials
   - Create Credentials > Service Account
   - Fill details:
     * Service account name: "car-rental-uploader"
     * Click "Continue"
   - Skip steps and click "Create"

5. Get Credentials:
   - In the list, click on the service account you created
   - Go to "Keys" tab
   - "Add Key" > "Create new key" > "JSON"
   - Download the JSON file
```

### 2. יצירת תיקייה ב-Google Drive

```
1. Open Google Drive: https://drive.google.com

2. Create folder:
   - Click "New" > "Folder"
   - Name: "car-rental-photos"
   - Click "Create"

3. Get Folder ID:
   - Open the folder
   - Copy the ID from the URL:
   https://drive.google.com/drive/folders/[FOLDER_ID_HERE]

4. Share with Service Account:
   - Right-click folder > "Share"
   - Paste the service account email (from JSON: "client_email")
   - Give "Editor" permissions
   - Click "Share"
```

### 3. הגדרת .env

עדכן את `backend/.env`:

```bash
# Google Drive Configuration
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_FOLDER_ID="1234567890_abc_def_ghi_jkl"
GOOGLE_DRIVE_CREDENTIALS_JSON='{"type":"service_account","project_id":"car-rental-app","private_key_id":"...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...'
```

**נוכחי**: Paste את כל ה-JSON מהקובץ שהורדנו בצורה raw, או encode בBase64.

### 4. התקנת Dependencies

```bash
cd backend
pip install -r requirements.txt
```

---

## 📱 שימוש במערכת

### וובי (דסקטופ)
1. Navigate ל-"ניהול הזמנות" (Bookings)
2. חפוש הזמנה פעילה (סטטוס = "פעיל")
3. לחץ על כפתור 📸 בעמודת "פעולות"
4. בחר תמונה מהמחשב שלך
5. המלצנה תעלה ל-Google Drive
6. אחרי האדה, קישור ל-Google Drive יפתח בטאב חדש

### מובייל
- אותו דבר, אבל הכפתור ב-"כפתור ✏️  ביצע" של הכרטיסיה

### ערוך הזמנה
- צילומים יכולים להעלות נרקחי לכל הזמנה פעילה
- אין צורך בעדכון ההזמנה עצמה

---

## ✍️ פירוט טכני

### Endpoint API

```http
POST /bookings/{booking_id}/upload-photo
Content-Type: multipart/form-data

Response (200):
{
  "success": true,
  "message": "הקובץ הועלה בהצלחה",
  "file_id": "1xB_drive_file_id",
  "file_name": "Booking_42_Tesla_ModelS_John_Doe.jpg",
  "link": "https://drive.google.com/file/d/1xB_...../view",
  "created_at": "2024-04-30T14:22:00Z"
}
```

### שמות קבצים
```
Booking_[ID]_[RachName]_[CustomerName].jpg

ודוגמה:
Booking_123_Honda_Civic_David_Cohen.jpg
```

### הגבלות
- גודל מקסימלי: 10 MB
- סוג קובץ: תמונות בלבד (JPG, PNG, WebP, GIF)
- הרשאות: Google Drive קובעות את הגישה

---

## 🐛 פתרון בעיות

### ❌ "שירות Google Drive אינו זמין"
**סיבה**: Google Drive לא מוגדר כהלכה
**פתרון**: 
- בדוק את ה-.env של GOOGLE_DRIVE_ENABLED=true
- בדוק שה-credentials JSON תקיני
- בדוק שה-Folder ID לא ריק

### ❌ "קובץ חייב להיות תמונה"
**סיבה**: בחרת קובץ שלא תמונה
**פתרון**: בחר תמונה (JPG, PNG, etc.)

### ❌ "הקובץ גדול מדי"
**סיבה**: תמונה גדולה מ-10MB
**פתרון**: דחוס את התמונה בעזרת כלי כמו:
- https://tinypng.com
- https://compress.jpeg.io

### ❌ "הקובץ ריק"
**סיבה**: בחרת קובץ בוהו
**פתרון**: בחר קובץ תמונה תקין

### ❌ הקובץ לא נראה ב-Google Drive
**סיבה**: ה-service account או ה-folder ID לא נכון
**פתרון**:
- בדוק שה-Service Account חולק עם הتmppe
- בדוק שה-Folder ID נכון (עדכנו אם בעניין)

---

## 🔒 אבטחה

✓ Service Account (לא מפתח API רגיל)
✓ Credentials מאובטחות ב-.env
✓ לא מאחסנים תמונות בשרת
✓ Google Drive מחלק גישה
✓ כל קובץ מתועד ב-Audit Log

---

## 📊 דוגמא זרימת עבודה

```
User: "אני צריך להעלות צילום של הח.זה ל-Google Drive"

1. פתח הזמנה בMedallions Dashboard
2. לחץ 📸
3. בחר תמונת RFC
4. המערכת:
   - בודקת את סוג הקובץ
   - בודקת את הגודל
   - מעלה ל-Google Drive
   - מוגדר את ה-metadata (booking #, car name)
   - שומרת ה-link בауыт Logs
5. משתמש: "מוצא את הקובץ ב-Google Drive"
```

---

## 📞 תמיכה / שאלות

אם יש בעיות:
1. בדוק את ה-GOOGLE_DRIVE_SETUP.md
2. בדוק את ה-Backend Logs
3. בדוק את ה-Google Cloud Console
4. וודא שה-Service Account משותף עם התיקייה

---

## ✅ Checklist

```
□ יצרתי Service Account בGoogle Cloud
□ הורדתי את credentials JSON
□ יצרתי תיקייה בGoogle Drive
□ שיתפתי את התיקייה עם Service Account
□ עדכנתי את ה-.env
□ הרצתי pip install
□ אתבדקתי את היומנים בחיפוש "Google Drive service initialized"
□ העלמתי צילום בהצלחה
□ הקובץ מופיע בGoogle Drive
```

---

אהרון! היא מוכנה לשימוש! 🎉

