GREAT INDIA CREATOR — GITHUB ACTIONS VIDEO WORKER (SECRET-READY)

Firebase project: great-india-creatore
GitHub repository: indiaeducat482-collab/great-india-creatore

IMPORTANT SECURITY NOTE
The workflow is already wired to these GitHub Actions secrets:
  GEMINI_API_KEY
  FIREBASE_SERVICE_ACCOUNT_JSON

Their real values are intentionally NOT stored inside this ZIP. This is required for security: a Gemini API key or Firebase service-account private key must never be placed in HTML/JS or committed to a public GitHub repository.

The workflow reads them automatically as:
  ${{ secrets.GEMINI_API_KEY }}
  ${{ secrets.FIREBASE_SERVICE_ACCOUNT_JSON }}

ONE-TIME GITHUB SETUP
1. Upload all files from this ZIP to the repository root.
2. Open GitHub → Settings → Secrets and variables → Actions.
3. Add repository secret named GEMINI_API_KEY and paste your Gemini API key there.
4. Add repository secret named FIREBASE_SERVICE_ACCOUNT_JSON and paste the complete Firebase service-account JSON there.
5. Open Actions → Great India Creator - AI Video Worker → Run workflow.
6. Create a NEW video job in the website.

Do NOT create files named .env, service-account.json, firebase-adminsdk.json, or put API keys in JS/HTML.

The worker uses GitHub Actions instead of Firebase Cloud Functions, so Firebase can remain on Spark for this architecture.
