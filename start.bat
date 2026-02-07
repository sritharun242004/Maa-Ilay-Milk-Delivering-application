@echo off
REM Maa Ilay - Start Script (Windows Reliable)
REM Starts both backend and frontend servers using npm.cmd

echo.
echo 🥛 Starting Maa Ilay...
echo.

REM Create logs directory
if not exist logs mkdir logs

REM Start backend
echo 🔧 Starting Express backend (port 4000)...
start "Maa Ilay Backend" cmd /k "cd backend-express && npm.cmd run dev"

REM Start frontend
echo 🎨 Starting React frontend (port 5173)...
start "Maa Ilay Frontend" cmd /k "cd frontend && npm.cmd run dev"

echo.
echo ╔═══════════════════════════════════════════════════╗
echo ║                                                   ║
echo ║    🥛 Maa Ilay is starting!                      ║
echo ║                                                   ║
echo ║    🌐 URL: http://localhost:5173                 ║
echo ║                                                   ║
echo ║    Note: If 5173 is busy, it may use 5174        ║
echo ║                                                   ║
echo ╚═══════════════════════════════════════════════════╝
echo.

exit
