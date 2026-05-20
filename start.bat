@echo off
echo ==========================================
echo   POIRO - AI Battle Room Setup
echo ==========================================
echo.

echo [1/4] Setting up backend...
cd backend
if not exist .env (
    copy .env.example .env
    echo   Created backend\.env
)
pip install -r requirements.txt
echo   Backend dependencies installed.
cd ..

echo.
echo [2/4] Setting up frontend...
cd frontend
if not exist .env.local (
    copy .env.example .env.local
    echo   Created frontend\.env.local
)
npm install
echo   Frontend dependencies installed.
cd ..

echo.
echo [3/4] Starting backend in new window...
start "Poiro Backend" cmd /k "cd backend && uvicorn app.main:app --reload --port 8000"

echo.
echo [4/4] Starting frontend in new window...
start "Poiro Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ==========================================
echo   Poiro is starting!
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo ==========================================
pause
