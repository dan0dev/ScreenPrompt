; ScreenPrompt NSIS Installer Script
; Requires NSIS 3.0 or higher (https://nsis.sourceforge.io/)

;--------------------------------
; Includes

!include "MUI2.nsh"
!include "FileFunc.nsh"

;--------------------------------
; Configuration

; Read version from file
!define /file VERSION "version.txt"
!define PRODUCT_NAME "ScreenPrompt"
!define PRODUCT_PUBLISHER "ScreenPrompt Contributors"
!define PRODUCT_WEB_SITE "https://github.com/dan0dev/ScreenPrompt"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; Architecture - passed via /DARCH=x64 or /DARCH=x86 (default: x64)
!ifndef ARCH
    !define ARCH "x64"
!endif

; Application details
Name "${PRODUCT_NAME} ${VERSION}"
OutFile "dist\${PRODUCT_NAME}_${VERSION}_${ARCH}-setup.exe"
!if "${ARCH}" == "x64"
    InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
!else
    InstallDir "$PROGRAMFILES\${PRODUCT_NAME}"
!endif
InstallDirRegKey HKLM "Software\${PRODUCT_NAME}" "InstallDir"
RequestExecutionLevel admin

; Compression
SetCompressor /SOLID lzma

;--------------------------------
; Interface Settings

!define MUI_ABORTWARNING
!define MUI_ICON "assets\icon.ico"
!define MUI_UNICON "assets\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_WELCOMEFINISHPAGE_BITMAP_NOSTRETCH
!define MUI_UNWELCOMEFINISHPAGE_BITMAP_NOSTRETCH

;--------------------------------
; Pages

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\ScreenPrompt.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCT_NAME}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

;--------------------------------
; Languages

!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Installer Sections

Section "Core Files" SecCore
    SectionIn RO  ; Read-only, always installed

    ; Set output path to installation directory
    SetOutPath "$INSTDIR"

    ; Copy all files from PyInstaller dist directory
    File /r "dist\ScreenPrompt\*"

    ; Create application data directory
    CreateDirectory "$APPDATA\ScreenPrompt"

    ; Store installation folder
    WriteRegStr HKLM "Software\${PRODUCT_NAME}" "InstallDir" "$INSTDIR"

    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Write uninstall information to registry
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\ScreenPrompt.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${VERSION}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1

    ; Calculate installed size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Start Menu Shortcuts" SecStartMenu
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\ScreenPrompt.exe"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Desktop Shortcut" SecDesktop
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\ScreenPrompt.exe"
SectionEnd

;--------------------------------
; Descriptions

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} "Core application files (required)"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Add shortcuts to Start Menu"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Add shortcut to Desktop"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
; Uninstaller Section

Section "Uninstall"
    ; Remove files and directories
    RMDir /r "$INSTDIR"

    ; Remove shortcuts
    Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
    RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Remove registry keys
    DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "Software\${PRODUCT_NAME}"

    ; Note: We don't delete $APPDATA\ScreenPrompt to preserve user settings
    ; Users can manually delete it if they want a clean uninstall
SectionEnd

;--------------------------------
; Installer Functions

Function .onInit
    ; Note: Windows 10 Build 2004+ is required for SetWindowDisplayAffinity
    ; Runtime version checking is done by the application itself

    ; Check if already installed
    ReadRegStr $R0 ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString"
    StrCmp $R0 "" done

    MessageBox MB_OKCANCEL|MB_ICONQUESTION \
        "${PRODUCT_NAME} is already installed.$\n$\nClick OK to remove the previous version or Cancel to cancel this installation." \
        IDOK uninst
    Abort

uninst:
    ; Run the uninstaller
    ClearErrors
    ExecWait '$R0 _?=$INSTDIR'

done:
FunctionEnd
