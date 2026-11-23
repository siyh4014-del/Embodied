@echo off
cd /d "%~dp0"
start "Growth Evidence Dashboard Server" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dashboard-hidden.ps1"
