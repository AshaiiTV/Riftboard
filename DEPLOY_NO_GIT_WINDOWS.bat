@echo off
setlocal
chcp 65001 >nul

echo.
echo ========================================
echo   NXT5 - Deploy Netlify SANS GIT
 echo ========================================
echo.

echo Verification de Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ERREUR: Node.js n'est pas installe.
  echo Installe Node.js LTS ici : https://nodejs.org/
  echo Puis relance ce fichier.
  echo.
  pause
  exit /b 1
)

echo Node OK.
echo.

echo Installation des dependances...
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ERREUR: npm install a echoue.
  echo.
  pause
  exit /b 1
)

echo.
echo Connexion a Netlify...
echo Une page web va s'ouvrir. Connecte-toi a ton compte Netlify.
call npx netlify login
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ERREUR: connexion Netlify impossible.
  echo.
  pause
  exit /b 1
)

echo.
echo Deploiement production...
echo Si Netlify demande quoi faire : choisis "Link this directory to an existing site" si ton site existe deja.
echo Sinon choisis "Create and configure a new site".
echo.
call npx netlify deploy --prod
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ERREUR: deploiement impossible.
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Deploy termine.
echo ========================================
echo.
echo IMPORTANT maintenant dans Netlify:
echo Site configuration ^> Environment variables
 echo Ajoute DATABASE_URL, RIOT_API_KEY, SESSION_SECRET, APP_ENV
 echo Puis relance un deploy si besoin.
echo.
pause
