# 🥛 Maa Ilay - Setup Guide

Hey! Here's how to run the Maa Ilay app on your computer.

---

## ⚡ Super Quick Start

### **macOS / Linux:**

**Step 1: One-Time Setup**
```bash
./setup.sh
```

**Step 2: Start the App**
```bash
./start.sh
```

**Step 3: Open in Browser**
Go to: **http://localhost:5173**

**To stop:** Press `Ctrl+C` in the terminal.

---

### **Windows:**

**Step 1: One-Time Setup**
```cmd
setup.bat
```

**Step 2: Start the App**
```cmd
start.bat
```

**Step 3: Open in Browser**
Go to: **http://localhost:5173**

**To stop:** Close the terminal windows.

---

## 📋 What You Need Installed

Make sure you have these on your computer:

1. **Node.js** (v18 or higher)
   - Check: `node --version`
   - Download: https://nodejs.org

2. **npm** (comes with Node.js)
   - Check: `npm --version`

That's it! Everything else is installed automatically.

---

## 🎯 How to Use the App

### **Customer Login (Google)**
1. Go to: http://localhost:5173
2. Click "Subscribe / Login"
3. Click "Continue with Google"
4. Select your Google account
5. Fill in your profile (first time only)
6. Access your dashboard!

### **Admin Login**
1. Go to: http://localhost:5173/admin/login
2. Email: `admin@maailay.com`
3. Password: `admin123`

### **Delivery Person Login**
1. Go to: http://localhost:5173/delivery/login
2. Phone: `9876543211`
3. Password: `vijay123`

---

## 📁 Folder Structure

```
maa-ilay/
├── start.sh           ← Run this to start the app!
├── setup.sh           ← Run this once for setup
├── backend-express/   ← Backend code (port 4000)
├── frontend/          ← Frontend code (port 5173)
└── logs/              ← Log files (if something breaks)
```

---

## 🐛 If Something Goes Wrong

### **"Port already in use"**
```bash
# Kill existing processes
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Try again
./start.sh
```

### **"Dependencies missing"**
```bash
# Re-run setup
./setup.sh
```

### **"Cannot connect to database"**
This means the database connection isn't working. The app uses a cloud database (Neon) that should work automatically. If you see this error, let Tharun know!

### **Check Logs**
If the app doesn't start, check these files:
- `logs/backend.log` - Backend errors
- `logs/frontend.log` - Frontend errors

---

## 💡 Tips

1. **Keep the terminal open** while using the app
2. **Don't close the terminal** - it's running the servers
3. **Press Ctrl+C** when you're done to stop everything
4. **Clear browser cache** if you see old data

---

## 🎨 What You Can Do

- ✅ Customer sign up with Google
- ✅ Subscribe to milk delivery
- ✅ Manage wallet and payments
- ✅ Pause delivery dates
- ✅ View delivery history
- ✅ Admin: Approve customers, manage deliveries
- ✅ Delivery: Track today's deliveries, collect bottles

---

## 📞 Need Help?

If you run into issues:
1. Check the `logs/` folder for error messages
2. Try running `./setup.sh` again
3. Contact Tharun!

---

**Enjoy fresh milk every morning! 🥛✨**
