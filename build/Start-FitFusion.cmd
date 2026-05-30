@echo off
title FitFusion - Expo Dev Server
set "PATH=C:\Users\Samuel\tools\node;%PATH%"
cd /d "C:\Users\Samuel\fitness-app\app"
echo ================================================
echo   FitFusion - Expo Dev Server wird gestartet...
echo   Scanne den QR-Code unten mit der Expo Go App.
echo   Fenster offen lassen. Beenden mit STRG + C.
echo ================================================
echo.
call npm start
