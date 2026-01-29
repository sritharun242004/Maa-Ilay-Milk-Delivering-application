#!/bin/bash

# Maa Ilay - One-time Setup Script
# Run this ONCE after unzipping

echo "🥛 Setting up Maa Ilay..."

# Create logs directory
mkdir -p logs

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend-express
npm install
echo "✅ Backend dependencies installed"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
echo "✅ Frontend dependencies installed"
cd ..

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║                                                   ║"
echo "║    ✅ Setup Complete!                            ║"
echo "║                                                   ║"
echo "║    Run: ./start.sh                               ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
