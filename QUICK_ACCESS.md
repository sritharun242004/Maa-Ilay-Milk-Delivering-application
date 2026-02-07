# 🚀 Quick Access Guide - Maa Ilay Application

## 🌐 Application URLs

### Main Application
**Frontend:** http://localhost:5173

### Login Pages

#### Customer Login (Google OAuth)
http://localhost:5173/customer/login

#### Admin Login
http://localhost:5173/admin/login
- **Email:** admin@maailay.com
- **Password:** admin123

#### Delivery Person Login
http://localhost:5173/delivery/login
- **Phone:** 9876543211
- **Password:** vijay123

---

## 🔧 Backend API

**Base URL:** http://localhost:4000

### Health Check
http://localhost:4000/health

### API Endpoints
- Authentication: http://localhost:4000/api/auth/*
- Customer: http://localhost:4000/api/customer/*
- Delivery: http://localhost:4000/api/delivery/*
- Admin: http://localhost:4000/api/admin/*

---

## 🎯 Quick Test Flow

### 1. Test Customer Flow
1. Open http://localhost:5173
2. Click "Subscribe / Login"
3. Login with Google
4. Complete onboarding form
5. Choose subscription plan (1L or 500ml)
6. Add money to wallet
7. View dashboard and deliveries

### 2. Test Admin Flow
1. Open http://localhost:5173/admin/login
2. Login with admin credentials
3. View dashboard
4. Manage customers (approve/reject)
5. Assign delivery persons
6. View reports

### 3. Test Delivery Flow
1. Open http://localhost:5173/delivery/login
2. Login with delivery credentials
3. View today's deliveries
4. Mark deliveries as completed
5. Collect/return bottles
6. View assignees and history

---

## ⚡ Server Control

### Check if Running
```powershell
Get-Process | Where-Object {$_.ProcessName -like "*node*"}
```

### Start Application
```cmd
cd "c:\Users\jancy\OneDrive\Documents\Maa Ilay\Maa-Ilay-Milk-Delivering-application"
.\start.bat
```

### Stop Application
Close the terminal windows or press Ctrl+C in each

---

## 📊 Current Status

✅ Backend: Running on port 4000
✅ Frontend: Running on port 5173
✅ Database: Connected (Neon PostgreSQL)
✅ Authentication: Google OAuth configured
✅ All routes: Active and responding

---

## 🔍 Troubleshooting

### If frontend doesn't load:
1. Check if port 5173 is in use
2. Restart the application
3. Clear browser cache

### If backend API fails:
1. Check if port 4000 is in use
2. Verify database connection in .env
3. Check logs in the terminal

### If login doesn't work:
1. Ensure both servers are running
2. Check browser console for errors
3. Verify CORS settings

---

**All systems operational! 🎉**

Access the app now: http://localhost:5173
