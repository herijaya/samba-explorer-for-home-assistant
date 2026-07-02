# Samba Explorer for Home Assistant

Browse, search, preview, upload, download, and manage files from remote SMB/Samba shares directly inside Home Assistant.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Custom%20Integration-41BDF5.svg)
![SMB](https://img.shields.io/badge/SMB-SMB2%20%7C%20SMB3-green.svg)

## Status

This project is in early development.

Current version: `0.1.0`

Available now:

- Home Assistant custom integration skeleton.
- Config flow for adding an SMB/Samba share.
- SMB connection test during setup.
- WebSocket API for listing folders and files.
- Sidebar panel for browsing configured SMB shares.

Planned next:

- Download, upload, rename, delete, copy, and move operations.
- File preview.
- Search.
- Favorites.
- Multi-server UX improvements.

## Main Idea

Samba Explorer makes SMB shares feel like part of Home Assistant:

- Browse folders and files from one or more SMB servers.
- Upload and download files from the Home Assistant UI.
- Preview common file types such as images, video, audio, PDF, and text.
- Search files across selected folders.
- Save favorite SMB locations for quick access.

## Features

### File Browser

- Browse remote SMB shares.
- Navigate folders.
- Breadcrumb navigation.
- Sort by name, size, modified date, and type.
- Show file size, file type, and last modified time.

### File Operations

- Download files. Planned.
- Upload files. Planned.
- Rename files and folders. Planned.
- Delete files and folders. Planned.
- Copy files. Planned.
- Move files. Planned.
- Create folders. Planned.

### Preview

- Image preview.
- Video playback.
- Audio playback.
- PDF preview.
- Text file viewer.

### Search

- Search inside the active share. Planned.
- Recursive folder search. Planned.
- Filter by extension. Planned.
- Filter by file type. Planned.

### Favorites

- Save frequently used SMB folders.
- Example favorites:
  - CCTV
  - Movies
  - Documents
  - Backups

### Multiple SMB Servers

Planned support for multiple SMB servers, such as:

- Ubuntu Samba server
- Windows shared folder
- Synology NAS
- TrueNAS
- OpenMediaVault
- Unraid

## Planned Architecture

```text
+-----------------------+
|   Home Assistant UI   |
+-----------+-----------+
            |
            | REST API / WebSocket
            |
+-----------v-----------+
| Samba Explorer Panel  |
+-----------+-----------+
            |
+-----------v-----------+
| Home Assistant        |
| Custom Integration    |
+-----------+-----------+
            |
+-----------v-----------+
| SMB Client Layer      |
+-----------+-----------+
            |
+-----------v-----------+
| Remote SMB Servers    |
+-----------------------+
```

## Planned Technology

Backend:

- Python
- Home Assistant custom integration
- SMB client library
- Home Assistant config flow
- Home Assistant services and WebSocket/API endpoints

Frontend:

- Home Assistant custom panel
- Lit
- Home Assistant UI components
- Responsive layout for desktop and mobile

## Target Folder Structure

```text
custom_components/
  samba_explorer/
    __init__.py
    manifest.json
    config_flow.py
    const.py
    smb_client.py
    websocket_api.py
    strings.json
    translations/
      en.json
    panel/
      samba-explorer-panel.js
```

## Installation

Manual installation:

1. Copy `custom_components/samba_explorer` into the Home Assistant `custom_components` folder.
2. Restart Home Assistant.
3. Add Samba Explorer from Settings > Devices & services.
4. Configure SMB server address, share name, username, password, and base path.
5. Open Samba Explorer from the Home Assistant sidebar.

HACS support is planned. The repository already includes `hacs.json`, but this integration still needs wider testing before being treated as stable.

## Configuration Concept

Example connection data:

```yaml
server: 192.168.1.10
share: media
username: homeassistant
password: your_password
base_path: /
domain: WORKGROUP
```

Credential storage should use Home Assistant config entries or secure storage patterns. Passwords should not be stored in plain text files.

## Roadmap

- [x] Create Home Assistant custom integration skeleton.
- [x] Add config flow for SMB server setup.
- [x] Implement SMB connection test.
- [x] List folders and files from a remote share.
- [x] Add sidebar panel.
- [x] Add folder navigation.
- [ ] Add file download.
- [ ] Add upload support.
- [ ] Add rename, delete, copy, move, and create folder operations.
- [ ] Add preview support.
- [ ] Add search.
- [ ] Add favorites.
- [ ] Add multi-server support.
- [ ] Prepare HACS support.
- [ ] Release version 1.0.

## Supported SMB Targets

Planned support:

- Samba 4.x
- Windows SMB shares
- Synology DSM
- TrueNAS SCALE
- TrueNAS CORE
- OpenMediaVault
- Unraid
- Any SMB2/SMB3 compatible server

## Security Notes

- Use a dedicated SMB user with limited permissions.
- Avoid using administrator/root SMB accounts.
- Limit access to only the shares needed by Home Assistant.
- Validate paths before file operations.
- Prevent directory traversal outside the configured base path.
- Confirm destructive actions such as delete and overwrite.

## Screenshots

Screenshots will be added after the first working UI is available.

## Development

Basic syntax check:

```bash
python -m py_compile custom_components/samba_explorer/*.py
```

Package contents:

```text
custom_components/samba_explorer
```

## Contributing

Ideas, bug reports, feature requests, and pull requests are welcome.

For early development, useful contributions include:

- Home Assistant integration structure.
- SMB browsing implementation.
- UI panel design.
- File operation safety checks.
- Testing with different SMB servers.

## License

MIT License.
