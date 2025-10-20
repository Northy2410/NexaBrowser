; NexaBrowser NSIS Installer Script
; Copyright © 2025 Riley Northcote

!define PRODUCT_NAME "NexaBrowser"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Riley Northcote"
!define PRODUCT_WEB_SITE "https://northy2410.github.io/NexaSearch"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

!include "MUI2.nsh"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "assets\icon.ico"
!define MUI_UNICON "assets\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\wizard.bmp"

; Welcome page
!insertmacro MUI_PAGE_WELCOME
; License page
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
; Directory page
!insertmacro MUI_PAGE_DIRECTORY
; Instfiles page
!insertmacro MUI_PAGE_INSTFILES
; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\NexaBrowser.exe"
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_INSTFILES

; Language files
!insertmacro MUI_LANGUAGE "English"

; Installer attributes
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "NexaBrowser-Setup.exe"
InstallDir "$PROGRAMFILES64\NexaBrowser"
InstallDirRegKey HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation"
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel admin

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite on
  
  ; Copy all files from the packaged directory
  File /r "dist\NexaBrowser-win32-x64\*.*"
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\NexaBrowser.exe"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" "$INSTDIR\uninst.exe"
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\NexaBrowser.exe"
SectionEnd

Section -AdditionalIcons
  WriteIniStr "$INSTDIR\${PRODUCT_NAME}.url" "InternetShortcut" "URL" "${PRODUCT_WEB_SITE}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Website.lnk" "$INSTDIR\${PRODUCT_NAME}.url"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\NexaBrowser.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
SectionEnd

Section Uninstall
  ; Remove shortcuts
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\*.*"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  
  ; Remove files and directories
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  Delete "$INSTDIR\*.*"
  RMDir "$INSTDIR"
  
  ; Remove registry keys
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  
  SetAutoClose true
SectionEnd
