# Push this project to GitHub

Run these commands **in your own terminal** (Terminal.app or iTerm, not inside Cursor), from the project folder:

```bash
cd "/Users/tharunkumarl/Full Stack/maa-ilay"
```

## 0. Make frontend part of this repo (do once)

The `frontend` folder has its own `.git`, so Git treats it as a separate repo. Remove it so the whole app is one repo:

```bash
rm -rf frontend/.git
```

## 1. Add the remote (once)

```bash
git remote add origin https://github.com/sritharun242004/Maa-Ilay-Milk-Delivering-application.git
```

(If you get "remote origin already exists", use:  
`git remote set-url origin https://github.com/sritharun242004/Maa-Ilay-Milk-Delivering-application.git`)

## 2. Stage and commit everything

```bash
git add .
git status
git commit -m "Maa Ilay: full app - Express backend, React frontend, setup scripts"
```

## 3. Push with your PAT (Personal Access Token)

**Option A – Push and type password when asked**

```bash
git push -u origin main
```

- Username: `sritharun242004`
- Password: paste your **Personal Access Token** (the one you use as GitHub password)

**Option B – One-time push with token in URL (replace YOUR_PAT with your token)**

```bash
git push https://sritharun242004:YOUR_PAT@github.com/sritharun242004/Maa-Ilay-Milk-Delivering-application.git main
```

Then set upstream so next time you can use `git push`:

```bash
git branch --set-upstream-to=origin/main main
```

---

## Important: revoke the token you shared

You used this token in chat. For security:

1. Go to: https://github.com/settings/tokens  
2. Find the token you used and **Revoke** it  
3. Create a **new** Personal Access Token  
4. Use the new token for future `git push` (or store it in Git Credential Manager)

After that, you can delete this file: `PUSH_TO_GITHUB.md`
