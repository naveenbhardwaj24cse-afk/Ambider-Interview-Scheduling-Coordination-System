@echo off
echo Starting Ambider Interview System...

echo Starting Backend Server (Port 5000)...
start cmd /k "cd server && npm run dev"

echo Starting Frontend Server (Vite)...
start cmd /k "cd client && npm run dev"

echo Both servers are starting up in new windows!
