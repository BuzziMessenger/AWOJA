@echo off
echo Bezig met het pushen van AWOJA naar GitHub...

:: 1. Voeg alle bestanden toe (respecteert de .gitignore)
git add .

:: 2. Vraag om een commit-bericht (optioneel, of gebruik een standaard tekst)
set /p msg="Voer je commit bericht in: "
if "%msg%"=="" set msg="Automatische update AWOJA"

:: 3. Commit de wijzigingen
git commit -m "%msg%"

:: 4. Push naar de main branch
git push -u origin main

echo.
echo Klaar! AWOJA staat op GitHub.
pause