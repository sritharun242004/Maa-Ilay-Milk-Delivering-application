@echo off
REM Maa Ilay - Start Script (Windows)
REM Starts both backend and frontend servers

echo.
echo 🥛 Starting Maa Ilay...
echo.

REM Create logs directory
if not exist logs mkdir logs

REM Start backend in new window
echo 🔧 Starting Express backend (port 4000)...
start "Maa Ilay Backend" cmd /k "cd backend-express && npm run dev"

REM Wait a bit
timeout /t 5 /nobreak >nul

REM Start frontend in new window
echo 🎨 Starting React frontend (port 5173)...
start "Maa Ilay Frontend" cmd /k "cd frontend && npm run dev"

REM Wait a bit
timeout /t 3 /nobreak >nul

echo.
echo ╔═══════════════════════════════════════════════════╗
echo ║                                                   ║
echo ║    🥛 Maa Ilay is running!                       ║
echo ║                                                   ║
echo ║    🌐 Open: http://localhost:5173                ║
echo ║    📚 Backend API: http://localhost:4000/api     ║
echo ║                                                   ║
echo ║    Close the terminal windows to stop            ║
echo ║                                                   ║
echo ╚═══════════════════════════════════════════════════╝
echo.

pause
