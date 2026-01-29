# 🥛 Maa Ilay - Fresh Milk Delivery System

A modern web application for managing milk subscription and glass bottle delivery service.

---

## 🚀 Quick Start (For Your Friend)

### **1️⃣ First Time Setup (Run Once)**

After unzipping the folder:

```bash
# Make scripts executable
chmod +x setup.sh start.sh

# Run setup (installs dependencies)
./setup.sh
```

This will:
- Install all dependencies (backend + frontend)
- Generate Prisma client
- Create logs folder

**Time:** ~2-3 minutes

---

### **2️⃣ Start the Application**

Every time you want to use the app:

```bash
./start.sh
```

This starts **both** backend and frontend together!

You'll see:
```
╔═══════════════════════════════════════════════════╗
║    🥛 Maa Ilay is running!                       ║
║    🌐 Open: http://localhost:5173                ║
╚═══════════════════════════════════════════════════╝
```

**Open your browser:** http://localhost:5173

**To stop:** Press `Ctrl+C` in the terminal

---

## 📂 Project Structure

```
maa-ilay/
├── backend-express/    # Express + Prisma backend (port 4000)
├── frontend/           # React + Vite frontend (port 5173)
├── start.sh           # ⭐ Start both servers
├── setup.sh           # ⭐ One-time setup
├── logs/              # Server logs (auto-created)
└── README.md          # This file
```

---

## 🧪 Test Accounts

### **Customer Login (Google OAuth)**
- Use any Google account
- First login → Complete profile form
- Dashboard shows subscription, wallet, deliveries

### **Admin Login**
- URL: http://localhost:5173/admin/login
- Email: `admin@maailay.com`
- Password: `admin123`

### **Delivery Person Login**
- URL: http://localhost:5173/delivery/login
- Phone: `9876543211`
- Password: `vijay123`

---

## 🔧 Google OAuth Setup (Important!)

The app uses Google OAuth for customer login. To make it work:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Use Client ID: `13725476808-4435uq2aiev2bllfhvutis7meuf4iv22...`
3. Add redirect URI: `http://localhost:5173/api/auth/google/callback`
4. Save

> **Note:** This is already configured in the `.env` file, but if you see "redirect_uri_mismatch", add the URI above.

---

## 💰 Pricing

| Plan | Daily Price | Bottle Deposit (every 90 days) |
|------|-------------|--------------------------------|
| 1L   | ₹110/day    | ₹70 (2 bottles × ₹35)          |
| 500ml| ₹68/day     | ₹50 (2 bottles × ₹25)          |

**Example Monthly Cost (31 days):**
- 1L: 1st month ₹3,480 (includes deposit), then ₹3,410 for 2 months, then ₹3,480 again
- 500ml: 1st month ₹2,158 (includes deposit), then ₹2,108 for 2 months, then ₹2,158 again

---

## 🗄️ Database

The app connects to a **Neon PostgreSQL** database (cloud-hosted). The connection string is already configured in `backend-express/.env`.

---

## 📝 Logs

If something goes wrong, check the logs:
- Backend: `logs/backend.log`
- Frontend: `logs/frontend.log`

---

## 🛑 Troubleshooting

### **Port already in use**
```bash
# Kill processes manually
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Then run ./start.sh again
```

### **Dependencies missing**
```bash
# Re-run setup
./setup.sh
```

### **Google login not working**
1. Make sure backend is running (check logs)
2. Add redirect URI in Google Console (see above)
3. Clear browser cache/cookies

---

## 🏗️ Tech Stack

**Frontend:**
- React + TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide React (icons)

**Backend:**
- Node.js + Express + TypeScript
- Passport.js (Google OAuth)
- Prisma ORM
- PostgreSQL (Neon)
- Session-based auth

---

## 📞 Support

For issues or questions, check:
- `logs/` folder for error logs
- `EXPRESS_MIGRATION_GUIDE.md` for detailed docs
- `START_HERE.md` in backend-express/

---

## ✅ Features

- 🔐 Google OAuth for customers
- 📱 Mobile-first, responsive design
- 💰 Wallet-based subscription management
- 📅 Pause/block delivery dates
- 🍾 Glass bottle tracking
- 📊 Admin dashboard
- 🚚 Delivery person portal
- 💳 Razorpay payment integration (configured)

---

Built with ❤️ for fresh milk delivery!
