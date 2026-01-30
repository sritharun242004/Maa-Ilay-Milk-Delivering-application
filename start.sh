#!/bin/bash

# Maa Ilay - Start Script
# Starts both backend and frontend servers

echo "🥛 Starting Maa Ilay..."

# Ensure logs directory exists
mkdir -p logs

# Kill any existing processes on ports 4000 and 5173
echo "Cleaning up existing processes..."
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Stopping servers..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}

trap cleanup EXIT INT TERM

# Start backend
echo "🔧 Starting Express backend (port 4000)..."
cd backend-express
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

sleep 3

# Check if backend started
if ! lsof -ti:4000 > /dev/null 2>&1; then
  echo "❌ Backend failed to start! Check logs/backend.log"
  exit 1
fi

echo "✅ Backend running on http://localhost:4000"

# Start frontend
echo "🎨 Starting React frontend (port 5173)..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

sleep 3

# Check if frontend started
if ! lsof -ti:5173 > /dev/null 2>&1; then
  echo "❌ Frontend failed to start! Check logs/frontend.log"
  exit 1
fi

echo "✅ Frontend running on http://localhost:5173"
echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║                                                   ║"
echo "║    🥛 Maa Ilay is running!                       ║"
echo "║                                                   ║"
echo "║    🌐 Open: http://localhost:5173                ║"
echo "║    📚 Backend API: http://localhost:4000/api     ║"
echo "║                                                   ║"
echo "║    Press Ctrl+C to stop both servers             ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "📝 Logs:"
echo "   Backend: logs/backend.log"
echo "   Frontend: logs/frontend.log"
echo ""

# Wait for processes
wait
