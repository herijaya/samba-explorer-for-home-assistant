"""HTTP views for Samba Explorer."""

from __future__ import annotations

import mimetypes
from pathlib import PurePosixPath

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .smb_client import SambaExplorerClient, SmbEntryConfig

mimetypes.add_type("video/x-matroska", ".mkv")
mimetypes.add_type("audio/flac", ".flac")


class SambaExplorerFileView(HomeAssistantView):
    """Serve files from a configured SMB share."""

    url = "/api/samba_explorer/file/{entry_id}"
    name = "api:samba_explorer:file"
    requires_auth = True

    async def get(self, request: web.Request, entry_id: str) -> web.Response:
        """Return a file response for preview or download."""
        hass: HomeAssistant = request.app["hass"]
        path = request.query.get("path", "")
        download = request.query.get("download") == "1"

        if not path:
            raise web.HTTPBadRequest(text="Missing path")

        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is None or entry.domain != DOMAIN:
            raise web.HTTPNotFound(text="Samba Explorer entry not found")

        client = SambaExplorerClient(SmbEntryConfig.from_mapping(entry.data))

        try:
            content = await hass.async_add_executor_job(client.read_file, path)
        except ValueError as err:
            raise web.HTTPBadRequest(text=str(err)) from err
        except Exception as err:
            raise web.HTTPInternalServerError(text=str(err)) from err

        filename = PurePosixPath(path).name or "download"
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        headers = {
            "Content-Disposition": f'{"attachment" if download else "inline"}; filename="{filename}"',
            "Cache-Control": "no-store",
        }
        return web.Response(body=content, content_type=content_type, headers=headers)
