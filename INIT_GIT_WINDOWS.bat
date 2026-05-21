@echo off
setlocal
chcp 65001 >nul

echo.
echo ========================================
echo   NXT5 - Initialisation Git
echo ========================================
echo.

where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo ERREUR: Git n'est pas installe ou pas disponible dans le terminal.
  echo Installe Git for Windows : https://git-scm.com/download/win
  echo Tu peux aussi utiliser GitHub Desktop : https://desktop.github.com/
  echo.
  pause
  exit /b 1
)

if exist .git (
  echo Ce dossier est deja un depot Git.
  git status
  echo.
  pause
  exit /b 0
)

git init
if %ERRORLEVEL% NEQ 0 goto error

git branch -M main
git add .
if %ERRORLEVEL% NEQ 0 goto error

git commit -m "Initial NXT5 Netlify app"
if %ERRORLEVEL% NEQ 0 goto error

echo.
echo Depot Git local cree avec succes.
echo.
echo Prochaine etape :
echo 1. Cree un repo vide sur GitHub.
echo 2. Copie l'URL HTTPS du repo.
echo 3. Lance :
echo.
echo    git remote add origin https://github.com/TON_COMPTE/nxt5.git
echo    git push -u origin main
echo.
pause
exit /b 0

:error
echo.
echo ERREUR: initialisation Git interrompue.
echo Regarde le message au-dessus, corrige, puis relance ce fichier.
echo.
pause
exit /b 1
