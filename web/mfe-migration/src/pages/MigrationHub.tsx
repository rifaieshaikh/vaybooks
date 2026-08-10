import { useMemo, useState, type ChangeEvent } from 'react';
import {
  useGetMigrationTemplateQuery,
  useListMigrationEntitiesQuery,
  useListMigrationProfilesQuery,
  useParseMigrationMutation,
  usePreviewMigrationMutation,
  useRunMigrationMutation,
  useSaveMigrationProfileMutation,
  useSuggestMigrationMappingMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

type Step = 0 | 1 | 2 | 3;
type DuplicatePolicy = 'skip' | 'update' | 'fail' | 'import_as_separate' | 'link_to_customer';

type Preview = {
  total_rows: number;
  valid_rows: number;
  can_import: boolean;
  issues: Issue[];
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  issues: Issue[];
};

type Issue = { row: number; message: string; field: string };
type Profile = { id: string; name: string; mapping: Record<string, string> };

const steps = ['Upload', 'Map', 'Dry-run', 'Import'];
const inputStyle = { padding: 8, minWidth: 220 };

function readableField(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function download(filename: string, content: string, type: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function MigrationHubPage() {
  const [entity, setEntity] = useState('customers');
  const [step, setStep] = useState<Step>(0);
  const [uploadId, setUploadId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [profileName, setProfileName] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>('skip');
  const [error, setError] = useState('');
  const entitiesQ = useListMigrationEntitiesQuery();
  const templateQ = useGetMigrationTemplateQuery(entity);
  const profilesQ = useListMigrationProfilesQuery({ entity });
  const [parseMigration, parseState] = useParseMigrationMutation();
  const [suggestMapping, suggestState] = useSuggestMigrationMappingMutation();
  const [previewMigration, previewState] = usePreviewMigrationMutation();
  const [runMigration, runState] = useRunMigrationMutation();
  const [saveProfile, saveProfileState] = useSaveMigrationProfileMutation();

  const entities = entitiesQ.data?.entities || ['categories', 'products', 'customers', 'vendors', 'leads'];
  const targetFields = useMemo(
    () => (templateQ.data?.csv || '').split(/\r?\n/, 1)[0]?.split(',').filter(Boolean) || [],
    [templateQ.data],
  );
  const profiles = (profilesQ.data || []) as Profile[];
  const isBusy =
    parseState.isLoading ||
    suggestState.isLoading ||
    previewState.isLoading ||
    runState.isLoading ||
    saveProfileState.isLoading;

  function resetAfterUpload() {
    setUploadId('');
    setSourceColumns([]);
    setMapping({});
    setPreview(null);
    setResult(null);
    setStep(0);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    setFile(event.target.files?.[0] || null);
    resetAfterUpload();
  }

  async function onUpload() {
    setError('');
    if (!file) {
      setError('Choose a CSV, XLSX, or JSON file first.');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
      const parsed = await parseMigration({
        filename: file.name,
        content_base64: btoa(binary),
      }).unwrap();
      const suggestion = await suggestMapping({ entity, upload_id: parsed.upload_id }).unwrap();
      setUploadId(parsed.upload_id);
      setSourceColumns(parsed.columns);
      setMapping(suggestion.mapping);
      setPreview(null);
      setResult(null);
      setStep(1);
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onPreview() {
    setError('');
    try {
      const nextPreview = await previewMigration({ upload_id: uploadId, entity, mapping }).unwrap();
      setPreview(nextPreview);
      setResult(null);
      setStep(2);
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onRun() {
    setError('');
    try {
      const nextResult = await runMigration({
        upload_id: uploadId,
        entity,
        mapping,
        duplicate_policy: duplicatePolicy,
      }).unwrap();
      setResult(nextResult);
      setStep(3);
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onSaveProfile() {
    setError('');
    if (!profileName.trim()) {
      setError('Enter a profile name.');
      return;
    }
    try {
      await saveProfile({ entity, name: profileName.trim(), mapping }).unwrap();
      setProfileName('');
      profilesQ.refetch();
    } catch (e) {
      setError(extractError(e));
    }
  }

  function updateMapping(target: string, source: string) {
    setMapping((current) => {
      const next = { ...current };
      if (source) next[target] = source;
      else delete next[target];
      return next;
    });
    setPreview(null);
    setResult(null);
  }

  const downloadIssues = (issues: Issue[], name: string) =>
    download(name, JSON.stringify(issues, null, 2), 'application/json');
  const downloadIssuesText = (issues: Issue[], name: string) =>
    download(
      name,
      issues.map((issue) => `Row ${issue.row}${issue.field ? ` (${issue.field})` : ''}: ${issue.message}`).join('\n'),
      'text/plain',
    );

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vb-color-primary, #185c4c)' }}>Data Migration</h2>
      <p style={{ marginBottom: 20 }}>Upload a source file, map its columns, validate it, then import.</p>
      {error ? <ErrorText>{error}</ErrorText> : null}

      <ol style={{ display: 'flex', gap: 18, listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
        {steps.map((name, index) => (
          <li
            key={name}
            style={{
              color: index <= step ? 'var(--vb-color-primary, #185c4c)' : 'var(--vb-color-muted, #777)',
              fontWeight: index === step ? 700 : 400,
            }}
          >
            {index + 1}. {name}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section>
          <h3>Upload</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <FormRow label="Import entity">
              <select
                value={entity}
                onChange={(event) => {
                  setEntity(event.target.value);
                  resetAfterUpload();
                }}
                style={inputStyle}
              >
                {entities.map((value) => (
                  <option key={value} value={value}>
                    {readableField(value)}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Source file">
              <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={onFileChange} style={inputStyle} />
            </FormRow>
            <Button type="button" onClick={onUpload} disabled={isBusy}>
              {parseState.isLoading || suggestState.isLoading ? 'Reading file…' : 'Upload and map'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              data-kb-action="migration.download_template"
              onClick={() => download(`${entity}-template.csv`, templateQ.data?.csv || '', 'text/csv')}
              disabled={!templateQ.data?.csv}
            >
              Download template
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h3>Map columns</h3>
          <p>{sourceColumns.length} source columns found. Select a source column for each destination field.</p>
          {templateQ.isLoading ? <p>Loading destination fields…</p> : null}
          {targetFields.map((target) => (
            <FormRow key={target} label={readableField(target)}>
              <select
                value={mapping[target] || ''}
                onChange={(event) => updateMapping(target, event.target.value)}
                style={inputStyle}
              >
                <option value="">Do not import</option>
                {sourceColumns.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </FormRow>
          ))}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, alignItems: 'end' }}>
            <FormRow label="Save mapping profile">
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="e.g. Legacy ERP"
                style={inputStyle}
              />
            </FormRow>
            <Button type="button" variant="ghost" onClick={onSaveProfile} disabled={isBusy}>
              Save profile
            </Button>
            <FormRow label="Load mapping profile">
              <select
                value={selectedProfileId}
                onChange={(event) => setSelectedProfileId(event.target.value)}
                style={inputStyle}
              >
                <option value="">Choose a saved profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <Button
              type="button"
              variant="ghost"
              data-kb-action="migration.apply_profile"
              disabled={!selectedProfileId}
              onClick={() => {
                const profile = profiles.find((item) => item.id === selectedProfileId);
                if (profile) setMapping(profile.mapping);
              }}
            >
              Apply profile
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              type="button"
              data-kb-action="migration.dry_run"
              onClick={onPreview}
              disabled={isBusy || !Object.keys(mapping).length}
            >
              {previewState.isLoading ? 'Validating…' : 'Run dry-run'}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && preview && (
        <section>
          <h3>Dry-run results</h3>
          <p>
            {preview.valid_rows} of {preview.total_rows} rows are valid.
          </p>
          {preview.issues.length > 0 ? (
            <>
              <ErrorText>{preview.issues.length} issue(s) need review before import.</ErrorText>
              <ul>
                {preview.issues.slice(0, 10).map((issue, index) => (
                  <li key={`${issue.row}-${issue.field}-${index}`}>
                    Row {issue.row}: {issue.message}
                    {issue.field ? ` (${issue.field})` : ''}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="ghost"
                  data-kb-action="migration.download_errors"
                  onClick={() => downloadIssues(preview.issues, 'migration-preview-issues.json')}
                >
                  Download issues JSON
                </Button>
                <Button type="button" variant="ghost" onClick={() => downloadIssuesText(preview.issues, 'migration-preview-issues.txt')}>
                  Download issues text
                </Button>
              </div>
            </>
          ) : (
            <p>No validation issues found.</p>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginTop: 20 }}>
            <FormRow label="If duplicate">
              <select
                value={duplicatePolicy}
                onChange={(event) => setDuplicatePolicy(event.target.value as DuplicatePolicy)}
                style={inputStyle}
              >
                <option value="skip">Skip existing record</option>
                <option value="update">Update existing record</option>
                <option value="fail">Fail duplicate row</option>
              </select>
            </FormRow>
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back to mapping
            </Button>
            <Button
              type="button"
              data-kb-action="migration.confirm_import"
              onClick={onRun}
              disabled={isBusy || !preview.can_import}
            >
              {runState.isLoading ? 'Importing…' : 'Confirm import'}
            </Button>
          </div>
          {!preview.can_import ? <ErrorText>Fix the validation issues before importing.</ErrorText> : null}
        </section>
      )}

      {step === 3 && result && (
        <section>
          <h3>Import complete</h3>
          <p>
            Created: {result.created} · Updated: {result.updated} · Skipped: {result.skipped} · Failed:{' '}
            {result.failed}
          </p>
          {result.issues.length > 0 ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button type="button" variant="ghost" onClick={() => downloadIssues(result.issues, 'migration-import-issues.json')}>
                Download import issues JSON
              </Button>
              <Button type="button" variant="ghost" onClick={() => downloadIssuesText(result.issues, 'migration-import-issues.txt')}>
                Download import issues text
              </Button>
            </div>
          ) : null}
          <div style={{ marginTop: 20 }}>
            <Button type="button" onClick={resetAfterUpload}>
              Start another import
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
