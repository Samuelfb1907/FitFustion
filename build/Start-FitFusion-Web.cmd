@echo off
title FitFusion - Web Preview
set "PATH=C:\Users\Samuel\tools\node;%PATH%"
cd /d "C:\Users\Samuel\fitness-app\app"
echo ================================================
echo   FitFusion - Browser-Vorschau wird gestartet...
echo   Der Browser oeffnet sich automatisch.
echo   Fenster offen lassen. Beenden mit STRG + C.
echo ================================================
echo.
call npm run web
