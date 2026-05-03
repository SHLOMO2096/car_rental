import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow

# The scopes we need
SCOPES = ['https://www.googleapis.com/auth/drive']

def main():
    print("==================================================")
    print("Google Drive OAuth2 Token Generator")
    print("==================================================\n")
    print("This script will help you bypass the Service Account restrictions")
    print("by generating a personal Refresh Token.\n")
    
    if not os.path.exists("credentials.json"):
        print("ERROR: credentials.json not found!")
        print("Please go to Google Cloud Console > APIs & Services > Credentials")
        print("1. Click 'Create Credentials' > 'OAuth client ID'")
        print("2. Application type: 'Desktop app'")
        print("3. Click Create, then Download JSON")
        print("4. Rename it to 'credentials.json' and place it in this folder.")
        return

    print("Opening browser for authentication... Please log in with the Google Account that owns the Google Drive folder.\n")
    
    flow = InstalledAppFlow.from_client_secrets_file(
        'credentials.json', SCOPES)
    creds = flow.run_local_server(port=0)

    # Convert the credentials to a dictionary
    creds_dict = {
        'token': creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri': creds.token_uri,
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'scopes': creds.scopes
    }

    # Save and show the output
    import base64
    json_str = json.dumps(creds_dict)
    b64_str = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
    
    print("\n✅ Authentication Successful!\n")
    print("Here is your new GOOGLE_DRIVE_CREDENTIALS_JSON string:")
    print("-" * 50)
    print(b64_str)
    print("-" * 50)
    
    with open("token.txt", "w") as f:
        f.write(b64_str)
        
    print("\n[!] IMPORTANT: I have also saved this string to a file named 'token.txt' in this folder!")
    print("Please open 'token.txt' and copy the text from there. Copying from the terminal often cuts off characters.")
    print("Replace the old string in your .env.production file with this exact text!")

if __name__ == '__main__':
    main()
