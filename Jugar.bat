@echo off
cd /d "%~dp0"
echo Abriendo AjedrezKiro con Stockfish...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
