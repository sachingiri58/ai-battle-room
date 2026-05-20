#!/bin/bash
set -e

echo "=========================================="
echo "  POIRO — AI Battle Room Setup"
echo "=========================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required. Please install Python 3.11+"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is required. Please install Node.js 18+"
    exit 1
fi

echo "[1/4] Setting up backend..."
cd backend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created backend/.env from .env.example"
fi
pip install -r requirements.txt -q
echo "  Backend dependencies installed."
cd ..

echo ""
echo "[2/4] Setting up frontend..."
cd frontend
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "  Created frontend/.env.local from .env.example"
fi
npm install --silent
echo "  Frontend dependencies installed."
cd ..

echo ""
echo "[3/4] Starting backend (port 8000)..."
cd backend
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..
sleep 2

echo ""
echo "[4/4] Starting frontend (port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "  ✅ Poiro is running!"
echo ""
echo "  🌐 Frontend: http://localhost:3000"
echo "  🔌 Backend:  http://localhost:8000"
echo "  📖 API Docs: http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo "=========================================="

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'; exit" INT
wait
