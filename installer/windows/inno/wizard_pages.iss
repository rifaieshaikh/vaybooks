// Custom wizard pages: Welcome, Backend, Mongo, Business, Modules, Admin, License

var
  WelcomePage: TWizardPage;
  BackendPage: TWizardPage;
  MongoPage: TWizardPage;
  BusinessPage: TWizardPage;
  ModulesPage: TWizardPage;
  AdminPage: TWizardPage;
  LicensePage: TWizardPage;

  BackendLocalRadio: TNewRadioButton;
  BackendRemoteRadio: TNewRadioButton;
  ApiBaseLabel: TNewStaticText;
  ApiBaseEdit: TNewEdit;

  MongoInstallRadio: TNewRadioButton;
  MongoExistingRadio: TNewRadioButton;
  MongoUriLabel: TNewStaticText;
  MongoUriEdit: TNewEdit;
  DbNameLabel: TNewStaticText;
  DbNameEdit: TNewEdit;

  LegalNameEdit: TNewEdit;
  TradeNameEdit: TNewEdit;
  GstinEdit: TNewEdit;
  PhoneEdit: TNewEdit;
  EmailEdit: TNewEdit;
  StateEdit: TNewEdit;
  FyMonthEdit: TNewEdit;

  BundleCombo: TNewComboBox;
  ModuleList: TNewCheckListBox;

  AdminUserEdit: TNewEdit;
  AdminDisplayEdit: TNewEdit;
  AdminEmailEdit: TNewEdit;
  AdminPassEdit: TNewEdit;
  AdminPass2Edit: TNewEdit;

  LicenseKeyEdit: TNewEdit;

  ModuleIds: TArrayOfString;

procedure InitModuleIds;
begin
  SetArrayLength(ModuleIds, 15);
  ModuleIds[0] := 'core';
  ModuleIds[1] := 'parties';
  ModuleIds[2] := 'crm';
  ModuleIds[3] := 'boutique';
  ModuleIds[4] := 'store';
  ModuleIds[5] := 'projects';
  ModuleIds[6] := 'sales';
  ModuleIds[7] := 'purchases';
  ModuleIds[8] := 'inventory';
  ModuleIds[9] := 'production';
  ModuleIds[10] := 'finance';
  ModuleIds[11] := 'schedulers';
  ModuleIds[12] := 'migration';
  ModuleIds[13] := 'settings';
  ModuleIds[14] := 'system';
end;

function ModuleIndexById(Id: String): Integer;
var
  I: Integer;
begin
  Result := -1;
  for I := 0 to GetArrayLength(ModuleIds) - 1 do
    if CompareText(ModuleIds[I], Id) = 0 then
    begin
      Result := I;
      Exit;
    end;
end;

procedure ForceModuleChecked(Id: String; Checked: Boolean);
var
  Idx: Integer;
begin
  Idx := ModuleIndexById(Id);
  if Idx >= 0 then
  begin
    ModuleList.ItemEnabled[Idx] := not (
      (CompareText(Id, 'core') = 0) or
      (CompareText(Id, 'parties') = 0) or
      (CompareText(Id, 'settings') = 0)
    );
    ModuleList.Checked[Idx] := Checked or (not ModuleList.ItemEnabled[Idx]);
  end;
end;

procedure ClearModuleChecks;
var
  I: Integer;
begin
  for I := 0 to ModuleList.Items.Count - 1 do
    ModuleList.Checked[I] := False;
  ForceModuleChecked('core', True);
  ForceModuleChecked('parties', True);
  ForceModuleChecked('settings', True);
end;

procedure ApplyBundlePreset(Preset: String);
begin
  ClearModuleChecks;
  if CompareText(Preset, 'core') = 0 then
  begin
    { already forced }
  end
  else if CompareText(Preset, 'boutique') = 0 then
  begin
    ForceModuleChecked('boutique', True);
    ForceModuleChecked('store', True);
    ForceModuleChecked('finance', True);
  end
  else if CompareText(Preset, 'trade') = 0 then
  begin
    ForceModuleChecked('inventory', True);
    ForceModuleChecked('sales', True);
    ForceModuleChecked('purchases', True);
    ForceModuleChecked('finance', True);
  end
  else if CompareText(Preset, 'crm') = 0 then
  begin
    ForceModuleChecked('crm', True);
  end
  else if CompareText(Preset, 'projects') = 0 then
  begin
    ForceModuleChecked('projects', True);
    ForceModuleChecked('finance', True);
  end
  else if CompareText(Preset, 'production') = 0 then
  begin
    ForceModuleChecked('inventory', True);
    ForceModuleChecked('production', True);
    ForceModuleChecked('finance', True);
  end
  else if CompareText(Preset, 'full') = 0 then
  begin
    ForceModuleChecked('crm', True);
    ForceModuleChecked('boutique', True);
    ForceModuleChecked('store', True);
    ForceModuleChecked('projects', True);
    ForceModuleChecked('sales', True);
    ForceModuleChecked('purchases', True);
    ForceModuleChecked('inventory', True);
    ForceModuleChecked('production', True);
    ForceModuleChecked('finance', True);
    ForceModuleChecked('schedulers', True);
    ForceModuleChecked('migration', True);
    ForceModuleChecked('system', True);
  end;
end;

procedure BundleComboChange(Sender: TObject);
var
  Preset: String;
begin
  case BundleCombo.ItemIndex of
    0: Preset := 'core';
    1: Preset := 'boutique';
    2: Preset := 'trade';
    3: Preset := 'crm';
    4: Preset := 'projects';
    5: Preset := 'production';
    6: Preset := 'full';
  else
    Preset := 'trade';
  end;
  ApplyBundlePreset(Preset);
end;

procedure BackendRadioClick(Sender: TObject);
begin
  ApiBaseEdit.Enabled := BackendRemoteRadio.Checked;
  ApiBaseLabel.Enabled := BackendRemoteRadio.Checked;
end;

procedure MongoRadioClick(Sender: TObject);
begin
  MongoUriEdit.Enabled := MongoExistingRadio.Checked;
  DbNameEdit.Enabled := MongoExistingRadio.Checked;
  MongoUriLabel.Enabled := MongoExistingRadio.Checked;
  DbNameLabel.Enabled := MongoExistingRadio.Checked;
end;

procedure InitializeWelcomePage;
var
  Info: TNewStaticText;
begin
  WelcomePage := CreateCustomPage(wpLicense, 'Welcome to VayBooks', 'Business management for Indian SMBs');
  Info := TNewStaticText.Create(WelcomePage);
  Info.Parent := WelcomePage.Surface;
  Info.Caption :=
    'VayBooks helps you run GST-ready sales, purchases, inventory, finance, and more.' + #13#10 + #13#10 +
    'This wizard configures how the desktop app connects to your backend and database,' + #13#10 +
    'then creates shortcuts to launch VayBooks.';
  Info.Left := 0;
  Info.Top := 0;
  Info.Width := WelcomePage.SurfaceWidth;
  Info.Height := 120;
  Info.WordWrap := True;
end;

procedure InitializeBackendPage;
var
  Info: TNewStaticText;
begin
  BackendPage := CreateCustomPage(WelcomePage.ID, 'Backend', 'Local API or remote server');
  Info := TNewStaticText.Create(BackendPage);
  Info.Parent := BackendPage.Surface;
  Info.Caption := 'Choose where the VayBooks API and web UI run.';
  Info.Width := BackendPage.SurfaceWidth;

  BackendLocalRadio := TNewRadioButton.Create(BackendPage);
  BackendLocalRadio.Parent := BackendPage.Surface;
  BackendLocalRadio.Caption := 'Local backend (install combined API on this PC)';
  BackendLocalRadio.Top := 40;
  BackendLocalRadio.Width := BackendPage.SurfaceWidth;
  BackendLocalRadio.Checked := True;
  BackendLocalRadio.OnClick := @BackendRadioClick;

  BackendRemoteRadio := TNewRadioButton.Create(BackendPage);
  BackendRemoteRadio.Parent := BackendPage.Surface;
  BackendRemoteRadio.Caption := 'Remote backend (thin client — Electron only)';
  BackendRemoteRadio.Top := 70;
  BackendRemoteRadio.Width := BackendPage.SurfaceWidth;
  BackendRemoteRadio.OnClick := @BackendRadioClick;

  ApiBaseLabel := TNewStaticText.Create(BackendPage);
  ApiBaseLabel.Parent := BackendPage.Surface;
  ApiBaseLabel.Caption := 'Remote API base URL (must serve UI at / and API at /api):';
  ApiBaseLabel.Top := 110;
  ApiBaseLabel.Width := BackendPage.SurfaceWidth;
  ApiBaseLabel.Enabled := False;

  ApiBaseEdit := TNewEdit.Create(BackendPage);
  ApiBaseEdit.Parent := BackendPage.Surface;
  ApiBaseEdit.Top := 130;
  ApiBaseEdit.Width := BackendPage.SurfaceWidth - 8;
  ApiBaseEdit.Text := 'https://vaybooks.example.com';
  ApiBaseEdit.Enabled := False;
end;

procedure InitializeMongoWizardPages;
var
  InfoText: TNewStaticText;
begin
  MongoPage := CreateCustomPage(BackendPage.ID, 'Database', 'MongoDB for local backend');
  InfoText := TNewStaticText.Create(MongoPage);
  InfoText.Parent := MongoPage.Surface;
  InfoText.Caption := 'Install MongoDB locally or connect to an existing instance.';
  InfoText.Width := MongoPage.SurfaceWidth;

  MongoInstallRadio := TNewRadioButton.Create(MongoPage);
  MongoInstallRadio.Parent := MongoPage.Surface;
  MongoInstallRadio.Caption := 'Install MongoDB locally (mongodb://localhost:27017)';
  MongoInstallRadio.Top := 40;
  MongoInstallRadio.Width := MongoPage.SurfaceWidth;
  MongoInstallRadio.OnClick := @MongoRadioClick;

  MongoExistingRadio := TNewRadioButton.Create(MongoPage);
  MongoExistingRadio.Parent := MongoPage.Surface;
  MongoExistingRadio.Caption := 'Use existing MongoDB connection';
  MongoExistingRadio.Top := 70;
  MongoExistingRadio.Width := MongoPage.SurfaceWidth;
  MongoExistingRadio.Checked := True;
  MongoExistingRadio.OnClick := @MongoRadioClick;

  MongoUriLabel := TNewStaticText.Create(MongoPage);
  MongoUriLabel.Parent := MongoPage.Surface;
  MongoUriLabel.Caption := 'Connection String:';
  MongoUriLabel.Top := 110;
  MongoUriLabel.Left := 20;

  MongoUriEdit := TNewEdit.Create(MongoPage);
  MongoUriEdit.Parent := MongoPage.Surface;
  MongoUriEdit.Left := 20;
  MongoUriEdit.Top := 130;
  MongoUriEdit.Width := MongoPage.SurfaceWidth - 40;
  MongoUriEdit.Text := 'mongodb+srv://user:password@cluster.mongodb.net/';

  DbNameLabel := TNewStaticText.Create(MongoPage);
  DbNameLabel.Parent := MongoPage.Surface;
  DbNameLabel.Caption := 'Database Name:';
  DbNameLabel.Left := 20;
  DbNameLabel.Top := 160;

  DbNameEdit := TNewEdit.Create(MongoPage);
  DbNameEdit.Parent := MongoPage.Surface;
  DbNameEdit.Left := 20;
  DbNameEdit.Top := 180;
  DbNameEdit.Width := MongoPage.SurfaceWidth - 40;
  DbNameEdit.Text := 'zahcci_customization';
end;

procedure InitializeBusinessPage;
var
  L: TNewStaticText;
begin
  BusinessPage := CreateCustomPage(MongoPage.ID, 'Business details', 'Company profile');
  L := TNewStaticText.Create(BusinessPage);
  L.Parent := BusinessPage.Surface;
  L.Caption := 'Legal name:';
  LegalNameEdit := TNewEdit.Create(BusinessPage);
  LegalNameEdit.Parent := BusinessPage.Surface;
  LegalNameEdit.Top := 18;
  LegalNameEdit.Width := BusinessPage.SurfaceWidth - 8;

  L := TNewStaticText.Create(BusinessPage);
  L.Parent := BusinessPage.Surface;
  L.Caption := 'Trade name:';
  L.Top := 48;
  TradeNameEdit := TNewEdit.Create(BusinessPage);
  TradeNameEdit.Parent := BusinessPage.Surface;
  TradeNameEdit.Top := 66;
  TradeNameEdit.Width := BusinessPage.SurfaceWidth - 8;

  L := TNewStaticText.Create(BusinessPage);
  L.Parent := BusinessPage.Surface;
  L.Caption := 'GSTIN / Phone / Email / State / FY start month (1-12):';
  L.Top := 96;
  L.Width := BusinessPage.SurfaceWidth;
  GstinEdit := TNewEdit.Create(BusinessPage);
  GstinEdit.Parent := BusinessPage.Surface;
  GstinEdit.Top := 116;
  GstinEdit.Width := 140;
  PhoneEdit := TNewEdit.Create(BusinessPage);
  PhoneEdit.Parent := BusinessPage.Surface;
  PhoneEdit.Top := 116;
  PhoneEdit.Left := 150;
  PhoneEdit.Width := 120;
  EmailEdit := TNewEdit.Create(BusinessPage);
  EmailEdit.Parent := BusinessPage.Surface;
  EmailEdit.Top := 116;
  EmailEdit.Left := 280;
  EmailEdit.Width := BusinessPage.SurfaceWidth - 288;
  StateEdit := TNewEdit.Create(BusinessPage);
  StateEdit.Parent := BusinessPage.Surface;
  StateEdit.Top := 150;
  StateEdit.Width := 80;
  StateEdit.Text := '';
  FyMonthEdit := TNewEdit.Create(BusinessPage);
  FyMonthEdit.Parent := BusinessPage.Surface;
  FyMonthEdit.Top := 150;
  FyMonthEdit.Left := 100;
  FyMonthEdit.Width := 40;
  FyMonthEdit.Text := '4';
end;

procedure InitializeModulesPage;
var
  L: TNewStaticText;
  Labels: TArrayOfString;
  I: Integer;
begin
  ModulesPage := CreateCustomPage(BusinessPage.ID, 'Modules', 'Enable product modules');
  InitModuleIds;
  L := TNewStaticText.Create(ModulesPage);
  L.Parent := ModulesPage.Surface;
  L.Caption := 'Bundle preset:';
  BundleCombo := TNewComboBox.Create(ModulesPage);
  BundleCombo.Parent := ModulesPage.Surface;
  BundleCombo.Top := 18;
  BundleCombo.Width := 220;
  BundleCombo.Style := csDropDownList;
  BundleCombo.Items.Add('Core');
  BundleCombo.Items.Add('Boutique');
  BundleCombo.Items.Add('Trade');
  BundleCombo.Items.Add('CRM');
  BundleCombo.Items.Add('Projects');
  BundleCombo.Items.Add('Production');
  BundleCombo.Items.Add('Full');
  BundleCombo.ItemIndex := 2;
  BundleCombo.OnChange := @BundleComboChange;

  ModuleList := TNewCheckListBox.Create(ModulesPage);
  ModuleList.Parent := ModulesPage.Surface;
  ModuleList.Top := 50;
  ModuleList.Width := ModulesPage.SurfaceWidth;
  ModuleList.Height := ModulesPage.SurfaceHeight - 60;
  SetArrayLength(Labels, 15);
  Labels[0] := 'Core';
  Labels[1] := 'Parties';
  Labels[2] := 'CRM';
  Labels[3] := 'Boutique';
  Labels[4] := 'Store';
  Labels[5] := 'Projects';
  Labels[6] := 'Sales';
  Labels[7] := 'Purchases';
  Labels[8] := 'Inventory';
  Labels[9] := 'Production';
  Labels[10] := 'Finance';
  Labels[11] := 'Schedulers';
  Labels[12] := 'Migration';
  Labels[13] := 'Settings';
  Labels[14] := 'System';
  for I := 0 to 14 do
    ModuleList.AddCheckBox(Labels[I], '', 0, False, True, False, True, nil);
  ApplyBundlePreset('trade');
end;

procedure InitializeAdminPage;
var
  L: TNewStaticText;
begin
  AdminPage := CreateCustomPage(ModulesPage.ID, 'Admin user', 'Create the owner account');
  L := TNewStaticText.Create(AdminPage);
  L.Parent := AdminPage.Surface;
  L.Caption := 'Username:';
  AdminUserEdit := TNewEdit.Create(AdminPage);
  AdminUserEdit.Parent := AdminPage.Surface;
  AdminUserEdit.Top := 18;
  AdminUserEdit.Width := 240;
  AdminUserEdit.Text := 'owner';

  L := TNewStaticText.Create(AdminPage);
  L.Parent := AdminPage.Surface;
  L.Caption := 'Display name:';
  L.Top := 48;
  AdminDisplayEdit := TNewEdit.Create(AdminPage);
  AdminDisplayEdit.Parent := AdminPage.Surface;
  AdminDisplayEdit.Top := 66;
  AdminDisplayEdit.Width := 240;

  L := TNewStaticText.Create(AdminPage);
  L.Parent := AdminPage.Surface;
  L.Caption := 'Email:';
  L.Top := 96;
  AdminEmailEdit := TNewEdit.Create(AdminPage);
  AdminEmailEdit.Parent := AdminPage.Surface;
  AdminEmailEdit.Top := 114;
  AdminEmailEdit.Width := 240;

  L := TNewStaticText.Create(AdminPage);
  L.Parent := AdminPage.Surface;
  L.Caption := 'Password:';
  L.Top := 144;
  AdminPassEdit := TNewEdit.Create(AdminPage);
  AdminPassEdit.Parent := AdminPage.Surface;
  AdminPassEdit.Top := 162;
  AdminPassEdit.Width := 240;
  AdminPassEdit.PasswordChar := '*';

  L := TNewStaticText.Create(AdminPage);
  L.Parent := AdminPage.Surface;
  L.Caption := 'Confirm password:';
  L.Top := 192;
  AdminPass2Edit := TNewEdit.Create(AdminPage);
  AdminPass2Edit.Parent := AdminPage.Surface;
  AdminPass2Edit.Top := 210;
  AdminPass2Edit.Width := 240;
  AdminPass2Edit.PasswordChar := '*';
end;

procedure InitializeLicensePage;
var
  L: TNewStaticText;
begin
  LicensePage := CreateCustomPage(AdminPage.ID, 'License', 'Optional license key (local backend)');
  L := TNewStaticText.Create(LicensePage);
  L.Parent := LicensePage.Surface;
  L.Caption := 'Enter a license key if you have one. Verification may fail initially; you can continue.';
  L.Width := LicensePage.SurfaceWidth;
  L.WordWrap := True;
  LicenseKeyEdit := TNewEdit.Create(LicensePage);
  LicenseKeyEdit.Parent := LicensePage.Surface;
  LicenseKeyEdit.Top := 50;
  LicenseKeyEdit.Width := LicensePage.SurfaceWidth - 8;
end;

procedure InitializeAllWizardPages;
begin
  InitializeWelcomePage;
  InitializeBackendPage;
  InitializeMongoWizardPages;
  InitializeBusinessPage;
  InitializeModulesPage;
  InitializeAdminPage;
  InitializeLicensePage;
end;

procedure BindMongoWizardEvents;
begin
  BackendLocalRadio.OnClick := @BackendRadioClick;
  BackendRemoteRadio.OnClick := @BackendRadioClick;
  MongoInstallRadio.OnClick := @MongoRadioClick;
  MongoExistingRadio.OnClick := @MongoRadioClick;
end;

function IsLocalBackend: Boolean;
begin
  if WizardSilent then
    Result := CompareText(ExpandConstant('{param:BACKEND|local}'), 'remote') <> 0
  else
    Result := BackendLocalRadio.Checked;
end;

function ShouldSkipPage(Page: TWizardPage): Boolean;
begin
  Result := False;
  if Page = MongoPage then
    Result := not IsLocalBackend
  else if Page = BusinessPage then
    Result := not IsLocalBackend
  else if Page = ModulesPage then
    Result := not IsLocalBackend
  else if Page = AdminPage then
    Result := not IsLocalBackend
  else if Page = LicensePage then
    Result := not IsLocalBackend;
end;

function GetBackendMode: String;
begin
  if IsLocalBackend then
    Result := 'local'
  else
    Result := 'remote';
end;

function GetApiBaseUrl: String;
begin
  if IsLocalBackend then
    Result := 'http://127.0.0.1:8000'
  else if WizardSilent then
    Result := ExpandConstant('{param:API_BASE_URL|}')
  else
    Result := Trim(ApiBaseEdit.Text);
end;

function GetMongoMode: String;
begin
  if WizardSilent then
  begin
    if CompareText(ExpandConstant('{param:MONGO|existing}'), 'install') = 0 then
      Result := 'install'
    else if CompareText(ExpandConstant('{param:MONGO|existing}'), 'local') = 0 then
      Result := 'install'
    else
      Result := 'existing';
  end
  else if MongoInstallRadio.Checked then
    Result := 'install'
  else
    Result := 'existing';
end;

function GetMongoUri: String;
begin
  if CompareText(GetMongoMode, 'install') = 0 then
    Result := 'mongodb://localhost:27017'
  else if WizardSilent then
    Result := ExpandConstant('{param:MONGO_URI|mongodb://localhost:27017}')
  else
    Result := Trim(MongoUriEdit.Text);
end;

function GetDbName: String;
begin
  if WizardSilent then
    Result := ExpandConstant('{param:DB_NAME|zahcci_customization}')
  else
    Result := Trim(DbNameEdit.Text);
end;

function GetSelectedModulesCsv: String;
var
  I: Integer;
  Parts: String;
begin
  Parts := '';
  if WizardSilent then
  begin
    Result := ExpandConstant('{param:MODULES|core,parties,inventory,sales,purchases,finance,settings}');
    Exit;
  end;
  for I := 0 to ModuleList.Items.Count - 1 do
  begin
    if ModuleList.Checked[I] then
    begin
      if Parts <> '' then
        Parts := Parts + ',';
      Parts := Parts + ModuleIds[I];
    end;
  end;
  Result := Parts;
end;

function JsonEscape(const S: String): String;
begin
  Result := S;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
  StringChangeEx(Result, #13#10, '\n', True);
  StringChangeEx(Result, #10, '\n', True);
end;

function BuildSetupJson: String;
var
  ModulesCsv: String;
  ModulesJson: String;
  I: Integer;
  Part: String;
begin
  ModulesCsv := GetSelectedModulesCsv;
  ModulesJson := '';
  while ModulesCsv <> '' do
  begin
    I := Pos(',', ModulesCsv);
    if I > 0 then
    begin
      Part := Copy(ModulesCsv, 1, I - 1);
      Delete(ModulesCsv, 1, I);
    end
    else
    begin
      Part := ModulesCsv;
      ModulesCsv := '';
    end;
    if ModulesJson <> '' then
      ModulesJson := ModulesJson + ',';
    ModulesJson := ModulesJson + '"' + JsonEscape(Trim(Part)) + '"';
  end;

  if WizardSilent then
  begin
    Result :=
      '{' +
      '"backend_mode":"' + JsonEscape(GetBackendMode) + '",' +
      '"api_base_url":"' + JsonEscape(GetApiBaseUrl) + '",' +
      '"mongo_mode":"' + JsonEscape(GetMongoMode) + '",' +
      '"mongo_uri":"' + JsonEscape(GetMongoUri) + '",' +
      '"db_name":"' + JsonEscape(GetDbName) + '",' +
      '"business":{"legal_name":"' + JsonEscape(ExpandConstant('{param:LEGAL_NAME|}')) + '","trade_name":"","gstin":"","phone":"","email":"","state_code":"","fy_start_month":4},' +
      '"enabled_modules":[' + ModulesJson + '],' +
      '"admin":{"username":"' + JsonEscape(ExpandConstant('{param:ADMIN_USER|owner}')) + '","display_name":"Owner","email":"","password":"' + JsonEscape(ExpandConstant('{param:ADMIN_PASS|}')) + '"},' +
      '"license_key":"' + JsonEscape(ExpandConstant('{param:LICENSE_KEY|}')) + '",' +
      '"app_version":"{#MyAppVersion}"' +
      '}';
    Exit;
  end;

  Result :=
    '{' +
    '"backend_mode":"' + JsonEscape(GetBackendMode) + '",' +
    '"api_base_url":"' + JsonEscape(GetApiBaseUrl) + '",' +
    '"mongo_mode":"' + JsonEscape(GetMongoMode) + '",' +
    '"mongo_uri":"' + JsonEscape(GetMongoUri) + '",' +
    '"db_name":"' + JsonEscape(GetDbName) + '",' +
    '"business":{' +
      '"legal_name":"' + JsonEscape(Trim(LegalNameEdit.Text)) + '",' +
      '"trade_name":"' + JsonEscape(Trim(TradeNameEdit.Text)) + '",' +
      '"gstin":"' + JsonEscape(Trim(GstinEdit.Text)) + '",' +
      '"phone":"' + JsonEscape(Trim(PhoneEdit.Text)) + '",' +
      '"email":"' + JsonEscape(Trim(EmailEdit.Text)) + '",' +
      '"state_code":"' + JsonEscape(Trim(StateEdit.Text)) + '",' +
      '"fy_start_month":' + Trim(FyMonthEdit.Text) +
    '},' +
    '"enabled_modules":[' + ModulesJson + '],' +
    '"admin":{' +
      '"username":"' + JsonEscape(Trim(AdminUserEdit.Text)) + '",' +
      '"display_name":"' + JsonEscape(Trim(AdminDisplayEdit.Text)) + '",' +
      '"email":"' + JsonEscape(Trim(AdminEmailEdit.Text)) + '",' +
      '"password":"' + JsonEscape(AdminPassEdit.Text) + '"' +
    '},' +
    '"license_key":"' + JsonEscape(Trim(LicenseKeyEdit.Text)) + '",' +
    '"app_version":"{#MyAppVersion}"' +
    '}';
end;

function ModulesPageValidate: Boolean;
var
  HasCrm, HasSales: Boolean;
  I: Integer;
begin
  Result := True;
  if not IsLocalBackend then
    Exit;
  if Trim(GetSelectedModulesCsv) = '' then
  begin
    MsgBox('Select at least one module.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  HasCrm := False;
  HasSales := False;
  for I := 0 to ModuleList.Items.Count - 1 do
  begin
    if ModuleList.Checked[I] and (CompareText(ModuleIds[I], 'crm') = 0) then
      HasCrm := True;
    if ModuleList.Checked[I] and (CompareText(ModuleIds[I], 'sales') = 0) then
      HasSales := True;
  end;
  if HasCrm and (not HasSales) then
  begin
    if MsgBox('CRM is enabled without Sales. Lead conversion and order flows may be limited. Continue?',
      mbConfirmation, MB_YESNO) = IDNO then
      Result := False;
  end;
end;

function AdminPageValidate: Boolean;
begin
  Result := True;
  if not IsLocalBackend then
    Exit;
  if Trim(AdminUserEdit.Text) = '' then
  begin
    MsgBox('Admin username is required.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if Length(AdminPassEdit.Text) < 4 then
  begin
    MsgBox('Password must be at least 4 characters.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if AdminPassEdit.Text <> AdminPass2Edit.Text then
  begin
    MsgBox('Passwords do not match.', mbError, MB_OK);
    Result := False;
  end;
end;

function LicensePageValidate: Boolean;
begin
  { Fail-soft: always allow continue }
  Result := True;
end;
