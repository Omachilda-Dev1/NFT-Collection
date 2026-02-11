@echo off
echo Installing dependencies...
call npm install

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Copy .env.example to .env and fill in your credentials
echo 2. Run: npm test
echo 3. Run: npm run compile
echo.
pause
