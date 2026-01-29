@echo off
REM Maa Ilay - One-time Setup Script (Windows)

echo.
echo 🥛 Setting up Maa Ilay...
echo.

REM Create logs directory
if not exist logs mkdir logs

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend-express
call npm install
if errorlevel 1 (
    echo ❌ Backend installation failed!
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed
echo.

REM Generate Prisma client
echo 🔧 Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo ❌ Prisma generation failed!
    pause
    exit /b 1
)
echo ✅ Prisma client generated
echo.
cd ..

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo ❌ Frontend installation failed!
    pause
    exit /b 1
)
echo ✅ Frontend dependencies installed
echo.
cd ..

echo.
echo ╔═══════════════════════════════════════════════════╗
echo ║                                                   ║
echo ║    ✅ Setup Complete!                            ║
echo ║                                                   ║
echo ║    Run: start.bat                                ║
echo ║                                                   ║
echo ╚═══════════════════════════════════════════════════╝
echo.

pause
