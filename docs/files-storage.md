# Files Storage

Attachment and document storage differs by deployment profile.

## Cloud / web

- **Backend:** S3-compatible object storage (AWS S3, MinIO, Azure Blob with S3 API).
- **Configuration:** `VAYBOOKS_FILES_BUCKET`, `VAYBOOKS_FILES_REGION`, credentials via IAM role or env secrets.
- **URLs:** Presigned GET for downloads; uploads via gateway POST → storage adapter.
- **Tenancy:** Key prefix `{org_id}/files/...` (see [`tenancy.md`](tenancy.md)).

## Desktop

- **Backend:** Local filesystem under `VAYBOOKS_DATA_DIR/files/`.
- **Configuration:** Set `VAYBOOKS_DATA_DIR` (e.g. `C:\ProgramData\VayBooks-BMS` on Windows).
- **Layout:**

```
{VAYBOOKS_DATA_DIR}/
  config/
  data/
  files/          ← binary attachments, PDFs, images
    {org_id}/
      ...
```

- **Backup:** Include `files/` in desktop backup jobs alongside Mongo dumps.

## Shared rules

| Concern | Rule |
|---------|------|
| Metadata | File records in Mongo (per-service DB); blob in S3 or local path |
| Max size | Enforced at gateway upload |
| Virus scan | Cloud hook placeholder (Phase 3+) |
| Migration | Streamlit-era paths may live under `{VAYBOOKS_DATA_DIR}/data/` — migrate pointers in DB |

## Code references

- Desktop path resolution: `vaybooks.bms.infrastructure.config.paths`
- Runtime mode: `VAYBOOKS_DATA_DIR` set → desktop; unset → cloud
