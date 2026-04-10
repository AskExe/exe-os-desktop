# Tauri Auto-Update Endpoint

The desktop app checks for updates on startup via the Tauri updater plugin.

## Endpoint Format

```
GET https://askexe.com/api/updates/{target}/{arch}/{current_version}
```

### Path Parameters

| Parameter         | Description                          | Example Values                    |
|-------------------|--------------------------------------|-----------------------------------|
| `target`          | OS target                            | `darwin`, `linux`, `windows`      |
| `arch`            | CPU architecture                     | `aarch64`, `x86_64`              |
| `current_version` | Semver version the client is running | `0.1.0`                          |

### Response (update available)

Return HTTP 200 with JSON:

```json
{
  "version": "0.2.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-04-10T12:00:00Z",
  "url": "https://askexe.com/releases/Exe%20OS.app.tar.gz",
  "signature": "<contents of Exe OS.app.tar.gz.sig>"
}
```

### Response (no update)

Return HTTP 204 (No Content) with an empty body.

## Signing

Updates are signed with a minisign keypair.

- **Public key**: embedded in `tauri.conf.json` under `plugins.updater.pubkey`
- **Private key**: stored at `~/.tauri/exe-os.key` (never committed)
- **Signature**: generated during `tauri build` when `TAURI_SIGNING_PRIVATE_KEY` is set

### Build with signing

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/exe-os.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri build
```

Output artifacts in `src-tauri/target/release/bundle/`:
- `macos/Exe OS.app.tar.gz` — updater bundle
- `macos/Exe OS.app.tar.gz.sig` — signature to include in endpoint response
- `dmg/Exe OS_x.y.z_aarch64.dmg` — installer for fresh installs

## Migration to v2 Updater

Currently using `"createUpdaterArtifacts": "v1Compatible"` for broad compatibility.
Once all users are on a version with the v2 updater plugin, change to `true` in
`tauri.conf.json` to use the newer artifact format.
