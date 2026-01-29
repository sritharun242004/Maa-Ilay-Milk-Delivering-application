# Start the Express backend

**You must run this before using the app.**

```bash
cd backend-express
npm run dev
```

Leave this terminal open. You should see:
```
🥛 Maa Ilay Express Backend
✅ Server running on port 4000
```

Then in a **second terminal** start the frontend:
```bash
cd frontend
npm run dev
```

---

## Google login: redirect_uri_mismatch?

Add this **exact** URL in Google Cloud Console:

1. Go to https://console.cloud.google.com/apis/credentials
2. Open your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs** click **+ ADD URI**
4. Add: `http://localhost:5173/api/auth/google/callback`
5. Save

No trailing slash. Use `http` (not https) and port **5173**.
