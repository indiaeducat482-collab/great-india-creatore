GREAT INDIA CREATOR — COMPLETE ZIP

Firebase project:
great-india-creatore

Already completed by user:
1. Firebase Authentication -> Email/Password enabled
2. Firestore Rules published
3. Firebase config added to js/firebase-config.js

UPLOAD / DEPLOY:
- Upload all files to the GitHub repository root, preserving folders.
- GitHub Pages can serve the static frontend.
- Firebase Functions must be deployed separately with Firebase CLI from the project folder:
  firebase login
  firebase use great-india-creatore
  firebase deploy --only functions

AI KEY:
The real AI backend expects a server-side Firebase Functions environment variable:
GEMINI_API_KEY
Do NOT put this key in frontend JS.
Configure it as a Firebase Functions secret/environment according to your Firebase Functions deployment setup.

IMPORTANT:
- Firebase Cloud Functions / Google Cloud services may require billing.
- The included video function generates a real MP4 with Hindi AI narration and a branded title card. Website-specific visual scenes can be expanded with screenshot rendering later.
- PPT function generates a real PPTX from extracted text. PDF/image OCR extraction is intentionally kept separate from the AI function; the frontend currently sends a placeholder for binary files. TXT/MD files work directly.
- Admin page is intentionally NOT secure yet. Do not expose it as an admin system until Firebase custom claims are implemented.
- Firestore rules currently use "presentations" collection, matching the frontend.
