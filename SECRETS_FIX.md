# 🔐 Secrets Exposed – What Happened & What to Do

GitGuardian reported **1 internal secret incident** in commit `fedf510` (the first push).

---

## What was exposed

1. **Basic Auth–style secret**  
   GitGuardian detected a "Basic Auth String" in that commit. Likely sources:
   - **`backend/.next/`** – Next.js build/cache was committed. Build output can contain inlined env vars (e.g. `GOOGLE_CLIENT_ID`, `DATABASE_URL`). We confirmed `GOOGLE_CLIENT_ID` appears in those files.
   - **GitHub PAT** – If the push URL (with PAT) was ever stored in a committed file or in history, it would also match "Basic Auth String."

2. **`.env` files**  
   They are in `.gitignore` and were **not** in the commit. Your current **backend-express/.env** and **backend/.env** on disk were not pushed. Only build artifacts (and possibly PAT in history) are the concern.

---

## What we fixed in the repo

- **Stopped tracking `backend/.next/`** – It’s removed from Git so future commits won’t include build cache.
- **`.gitignore` updated** – `backend/.next/`, `backend/node_modules/`, and `.env` files are ignored so they won’t be committed again.

**Important:** The secret is still in **Git history** (commit `fedf510`). Anyone with clone access can see it until you either rewrite history or rotate the secrets.

---

## What you should do now

### 1. Rotate these secrets (recommended)

Because the secret is in history, treat these as compromised and rotate them:

| Secret | Where to rotate |
|--------|-----------------|
| **Neon DB password** | [Neon Console](https://console.neon.tech) → your project → Reset password. Update `DATABASE_URL` in `backend-express/.env` and `backend/.env`. |
| **Google OAuth client secret** | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth client → Create new client secret, delete old one. Update `GOOGLE_CLIENT_SECRET` in both `.env` files. |
| **GitHub PAT** | You said you’ll revoke after push – do that at [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens). Create a new PAT for future pushes. |
| **Session secret** | In `.env`: run `openssl rand -base64 32` and set `SESSION_SECRET` (and `NEXTAUTH_SECRET` in backend if still used). |

### 2. (Optional) Remove secret from Git history

If you want to remove the exposed data from history (advanced):

- Use [git-filter-repo](https://github.com/newren/git-filter-repo) or [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) to delete `backend/.next/` from all commits.
- Then force-push: `git push --force origin main`.

**Warning:** Force-pushing rewrites history. Only do this if you’re sure no one else is basing work on the current history.

### 3. Keep secrets out of future commits

- Never commit `.env` or any file that contains real keys/passwords.
- Don’t commit build output: `backend/.next/`, `frontend/dist/`, etc. (already in `.gitignore`).
- Use `.env.example` with placeholder values (e.g. `DATABASE_URL=postgresql://user:password@host/db`) and keep real values only in `.env`.

---

## Summary

| Item | Status |
|------|--------|
| `.env` files | ✅ Not in repo (ignored) |
| `backend/.next/` | ✅ No longer tracked; still in old commit history |
| GitGuardian “Basic Auth” | Caused by build cache (and possibly PAT in history) |
| Next step | Rotate DB, Google, GitHub, and session secrets; optionally clean history |

After rotating secrets and (optionally) cleaning history, you can delete this file.
