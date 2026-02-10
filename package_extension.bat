@echo off
echo Packaging extension...
call npx vsce package --no-dependencies
echo.
if %errorlevel% equ 0 (
    echo Package created successfully!
) else (
    echo Packaging failed.
)
pause
