#define MyAppVersion "1.0.0"
#define MyAppName "VayBooks-BMS"
#define MyAppPublisher "VayBooks"
#define MyAppURL "https://github.com/rifaieshaikh/bms"
#define MyAppExeName "VayBooks-Launcher.exe"
#define ElectronExe "electron\win-unpacked\VayBooks.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableComponentsPage=yes
OutputDir=..\..\dist
OutputBaseFilename=VayBooks-BMS-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\..\assets\favicon.ico
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UsePreviousAppDir=yes
UninstallDisplayIcon={app}\{#ElectronExe}
LicenseFile=..\..\assets\LICENSE.rtf

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Types]
Name: "full"; Description: "Full installation"

[Components]
Name: "electron"; Description: "VayBooks Electron desktop app"; Types: full; Flags: fixed
Name: "api"; Description: "Local combined API (Python)"; Types: full
Name: "mongodb"; Description: "MongoDB Community Server (local install)"; Types: full

[Files]
; Always
Source: "..\..\dist\staging\electron\*"; DestDir: "{app}\electron"; Components: electron; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\staging\scripts\*"; DestDir: "{app}\scripts"; Components: electron; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\staging\tools\*"; DestDir: "{app}\tools"; Components: electron; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; Local API
Source: "..\..\dist\staging\python\*"; DestDir: "{app}\python"; Components: api; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\staging\app\*"; DestDir: "{app}\app"; Components: api; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\staging\ui\*"; DestDir: "{app}\ui"; Components: api; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
Source: "..\..\dist\staging\nssm\*"; DestDir: "{app}\nssm"; Components: api; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\dist\staging\service\*"; DestDir: "{app}\service"; Components: api; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
; Mongo MSI
Source: "..\..\dist\staging\downloads\mongodb.msi"; DestDir: "{tmp}"; Components: mongodb; Flags: deleteafterinstall skipifsourcedoesntexist
; Validation helpers extracted before install
Source: "..\scripts\validate_remote.ps1"; DestDir: "{tmp}"; Flags: dontcopy
Source: "..\scripts\validate_mongo.ps1"; DestDir: "{tmp}"; Flags: dontcopy

[Dirs]
Name: "{commonappdata}\{#MyAppName}\config"; Permissions: users-modify
Name: "{commonappdata}\{#MyAppName}\logs"; Permissions: users-modify
Name: "{commonappdata}\{#MyAppName}\data\uploads"; Permissions: users-modify
Name: "{commonappdata}\{#MyAppName}\data\backups"; Permissions: users-modify
Name: "{commonappdata}\{#MyAppName}\mongodb\data"; Components: mongodb; Permissions: users-modify
Name: "{commonappdata}\{#MyAppName}\migrations"; Permissions: users-modify

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\tools\{#MyAppExeName}"; WorkingDir: "{app}"; Check: FileExists(ExpandConstant('{app}\tools\{#MyAppExeName}'))
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#ElectronExe}"; WorkingDir: "{app}\electron\win-unpacked"; Check: not FileExists(ExpandConstant('{app}\tools\{#MyAppExeName}'))
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\tools\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon; Check: FileExists(ExpandConstant('{app}\tools\{#MyAppExeName}'))
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#ElectronExe}"; WorkingDir: "{app}\electron\win-unpacked"; Tasks: desktopicon; Check: not FileExists(ExpandConstant('{app}\tools\{#MyAppExeName}'))

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\tools\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: postinstall nowait skipifsilent; Check: FileExists(ExpandConstant('{app}\tools\{#MyAppExeName}'))
Filename: "{app}\{#ElectronExe}"; Description: "Launch {#MyAppName}"; Flags: postinstall nowait skipifsilent; Check: not FileExists(ExpandConstant('{app}\tools\{#MyAppExeName}'))

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\nssm\uninstall_service.ps1"" -InstallDir ""{app}"""; Flags: runhidden; Check: FileExists(ExpandConstant('{app}\nssm\uninstall_service.ps1'))

[Code]
#include "wizard_pages.iss"
#include "silent_params.iss"

var
  DataDir: String;

procedure ApplyComponentSelection;
begin
  if IsLocalBackend then
  begin
    if CompareText(GetMongoMode, 'install') = 0 then
      WizardSelectComponents('electron,api,mongodb')
    else
      WizardSelectComponents('electron,api,!mongodb');
  end
  else
    WizardSelectComponents('electron,!api,!mongodb');
end;

procedure InitializeWizard;
begin
  DataDir := ExpandConstant('{commonappdata}\{#MyAppName}');
  ExtractTemporaryFile('validate_remote.ps1');
  ExtractTemporaryFile('validate_mongo.ps1');
  if not WizardSilent then
  begin
    InitializeAllWizardPages;
    BindMongoWizardEvents;
  end;
  ApplyComponentSelection;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if WizardSilent then
    Exit;
  if (PageID = MongoPage.ID) or (PageID = BusinessPage.ID) or (PageID = ModulesPage.ID) or
     (PageID = AdminPage.ID) or (PageID = LicensePage.ID) then
    Result := not IsLocalBackend;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if WizardSilent then
    Exit;
  if CurPageID = BackendPage.ID then
  begin
    Result := BackendPageValidate;
    if Result then
      ApplyComponentSelection;
  end
  else if CurPageID = MongoPage.ID then
  begin
    Result := MongoPageValidate;
    if Result then
      ApplyComponentSelection;
  end
  else if CurPageID = ModulesPage.ID then
    Result := ModulesPageValidate
  else if CurPageID = AdminPage.ID then
    Result := AdminPageValidate
  else if CurPageID = LicensePage.ID then
    Result := LicensePageValidate;
end;

function ShouldInstallMongo: Boolean;
begin
  Result := IsLocalBackend and (CompareText(GetMongoMode, 'install') = 0);
end;

function BackendPageValidate: Boolean;
var
  ResultCode: Integer;
  Params: String;
  Url: String;
begin
  Result := True;
  if IsLocalBackend then
    Exit;
  if WizardSilent then
  begin
    Url := GetSilentApiBaseUrl;
  end
  else
    Url := Trim(ApiBaseEdit.Text);
  if (Url = '') or ((Pos('http://', LowerCase(Url)) <> 1) and (Pos('https://', LowerCase(Url)) <> 1)) then
  begin
    MsgBox('Enter a valid http:// or https:// API base URL.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  Params := '-ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\validate_remote.ps1') + '" -ApiBaseUrl "' + Url + '"';
  if Exec('powershell.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode <> 0 then
    begin
      MsgBox('Remote backend validation failed. Host must expose /health and serve text/html at /.', mbError, MB_OK);
      Result := False;
    end;
  end
  else
  begin
    MsgBox('Could not run remote validation script.', mbError, MB_OK);
    Result := False;
  end;
end;

function MongoPageValidate: Boolean;
var
  ResultCode: Integer;
  Params: String;
begin
  Result := True;
  if not IsLocalBackend then
    Exit;
  if CompareText(GetMongoMode, 'existing') = 0 then
  begin
    if Trim(GetMongoUri) = '' then
    begin
      MsgBox('Please enter a MongoDB connection string.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if Trim(GetDbName) = '' then
    begin
      MsgBox('Please enter a database name.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    Params := '-ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\validate_mongo.ps1') +
      '" -MongoUri "' + GetMongoUri + '" -DbName "' + GetDbName + '"';
    if Exec('powershell.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      if ResultCode <> 0 then
      begin
        MsgBox('Could not connect to MongoDB with the provided URI.', mbError, MB_OK);
        Result := False;
      end;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Params: String;
  SetupPath: String;
  Json: String;
begin
  if CurStep = ssInstall then
  begin
    ApplyComponentSelection;
    if FileExists(ExpandConstant('{app}\scripts\pre_upgrade.ps1')) then
    begin
      Params := '-ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\pre_upgrade.ps1') +
        '" -InstallDir "' + ExpandConstant('{app}') + '" -DataDir "' + DataDir +
        '" -AppVersion "{#MyAppVersion}"';
      Exec('powershell.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;

  if CurStep = ssPostInstall then
  begin
    ForceDirectories(DataDir + '\config');
    SetupPath := DataDir + '\config\setup.json';
    Json := BuildSetupJson;
    SaveStringToFile(SetupPath, Json, False);

    if ShouldInstallMongo and FileExists(ExpandConstant('{tmp}\mongodb.msi')) then
    begin
      Exec('msiexec.exe', '/i "' + ExpandConstant('{tmp}\mongodb.msi') + '" /qn ADDLOCAL="all" SHOULD_INSTALL_COMPASS="0"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    if FileExists(ExpandConstant('{app}\scripts\pre_install.ps1')) then
    begin
      Params := '-ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\pre_install.ps1') +
        '" -DataDir "' + DataDir + '"';
      Exec('powershell.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;

    Params := '-ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\post_install.ps1') +
      '" -InstallDir "' + ExpandConstant('{app}') + '" -DataDir "' + DataDir +
      '" -BackendMode "' + GetBackendMode + '" -ApiBaseUrl "' + GetApiBaseUrl +
      '" -MongoMode "' + GetMongoMode + '" -MongoUri "' + GetMongoUri +
      '" -DbName "' + GetDbName + '" -AppVersion "{#MyAppVersion}"' +
      ' -SetupJsonPath "' + SetupPath + '"';
    if not Exec('powershell.exe', Params, '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
      MsgBox('post_install.ps1 failed to start.', mbError, MB_OK)
    else if ResultCode <> 0 then
      MsgBox('Post-install failed with code ' + IntToStr(ResultCode) + '. Local bootstrap may be incomplete.', mbError, MB_OK);
  end;
end;

function InitializeUninstall: Boolean;
var
  Response: Integer;
begin
  Response := MsgBox('Remove user data in ' + ExpandConstant('{commonappdata}\{#MyAppName}') + '?',
    mbConfirmation, MB_YESNOCANCEL);
  if Response = IDCANCEL then
    Result := False
  else if Response = IDYES then
  begin
    DelTree(ExpandConstant('{commonappdata}\{#MyAppName}'), True, True, True);
    Result := True;
  end
  else
    Result := True;
end;

[InstallDelete]
Type: filesandordirs; Name: "{app}\python"
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\ui"
Type: filesandordirs; Name: "{app}\electron"
Type: filesandordirs; Name: "{app}\tools"
Type: filesandordirs; Name: "{app}\service"
Type: filesandordirs; Name: "{app}\nssm"
Type: filesandordirs; Name: "{app}\scripts"
