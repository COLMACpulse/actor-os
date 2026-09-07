@echo off
setlocal
cd /d "%~dp0"
echo ACTOR OS - POST RELAUNCH HASH VERIFIER
echo.
set /p FOLDER=Drag/type exported MASTER evidence folder path here: 
python verify_master_hashes.py "%FOLDER%"
echo.
echo Results written beside this script:
echo   post_relaunch_verification.json
echo   GAUNTLET_REPORT.html
pause
