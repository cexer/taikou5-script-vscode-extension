
$ExtensionName = "ztkhack.taikou5-script-0.0.1"
$SourceDir = $PSScriptRoot
$VscodeExtensionsDir = "$env:USERPROFILE\.vscode\extensions"
$TargetDir = Join-Path $VscodeExtensionsDir $ExtensionName

Write-Host "Installing Taikou V Script Extension..."
Write-Host "Source: $SourceDir"
Write-Host "Target: $TargetDir"

if (-not (Test-Path $VscodeExtensionsDir)) {
    Write-Warning "VS Code extensions directory not found at $VscodeExtensionsDir"
    Write-Warning "Please ensure VS Code is installed and run at least once."
    exit 1
}

if (Test-Path $TargetDir) {
    Write-Host "Removing existing extension version..."
    Remove-Item -Recurse -Force $TargetDir
}

# Try to create a symbolic link first (requires Admin or Developer Mode)
try {
    Write-Host "Attempting to create symbolic link..."
    New-Item -ItemType SymbolicLink -Path $TargetDir -Target $SourceDir | Out-Null
    Write-Host "Success! Symbolic link created."
    Write-Host "The extension will now auto-update when you edit files in the source directory."
}
catch {
    Write-Warning "Symbolic link creation failed (likely permission issue)."
    Write-Host "Falling back to copying files..."
    Copy-Item -Recurse -Path $SourceDir -Destination $TargetDir
    Write-Host "Success! Files copied."
    Write-Host "Note: Changes to source files won't reflect until you reinstall."
}

Write-Host "`nInstallation Complete!"
Write-Host "Please restart VS Code (or reload window) to see the changes."
