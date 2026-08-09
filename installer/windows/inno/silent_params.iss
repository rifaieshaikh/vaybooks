// Silent install parameters for VayBooks Electron installer
// /SILENT /BACKEND=local|remote /API_BASE_URL=... /MONGO=install|existing
// /MONGO_URI=... /DB_NAME=... /MODULES=... /ADMIN_USER=... /ADMIN_PASS=...
// /LEGAL_NAME=... /LICENSE_KEY=...

function GetSilentBackendMode: String;
begin
  Result := ExpandConstant('{param:BACKEND|local}');
end;

function GetSilentApiBaseUrl: String;
begin
  Result := ExpandConstant('{param:API_BASE_URL|http://127.0.0.1:8000}');
end;

function GetSilentMongoMode(Param: String): String;
var
  Raw: String;
begin
  Raw := ExpandConstant('{param:MONGO|existing}');
  if CompareText(Raw, 'local') = 0 then
    Result := 'install'
  else if CompareText(Raw, 'remote') = 0 then
    Result := 'existing'
  else
    Result := Raw;
end;

function GetSilentMongoUri: String;
begin
  Result := ExpandConstant('{param:MONGO_URI|mongodb://localhost:27017}');
end;

function GetSilentDbName: String;
begin
  Result := ExpandConstant('{param:DB_NAME|zahcci_customization}');
end;

function IsSilentInstall: Boolean;
begin
  Result := WizardSilent;
end;
