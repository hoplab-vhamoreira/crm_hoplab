@echo off
title HOP Lab CRM 2.0
cd /d "%~dp0"
echo.
echo  =====================================
echo   HOP Lab CRM 2.0 - A iniciar...
echo  =====================================
echo.
echo  Abrir no browser: http://localhost:5000
echo  Login: admin / admin
echo.
echo  Para parar o servidor: fechar esta janela
echo.
python server.py
pause
