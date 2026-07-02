"""HTTP views for Samba Explorer."""

from __future__ import annotations

import mimetypes
from pathlib import PurePosixPath
import re

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .smb_client import SambaExplorerClient, SmbEntryConfig

mimetypes.add_type("video/x-matroska", ".mkv")
mimetypes.add_type("audio/flac", ".flac")

RANGE_PATTERN = re.compile(r"bytes=(\d*)-(\d*)$")
DEFAULT_RANGE_CHUNK_SIZE = 4 * 1024 * 1024


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
        filename = PurePosixPath(path).name or "download"
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

        try:
            file_size = await hass.async_add_executor_job(client.get_file_size, path)
        except ValueError as err:
            raise web.HTTPBadRequest(text=str(err)) from err
        except Exception as err:
            raise web.HTTPInternalServerError(text=str(err)) from err

        headers = self._headers(filename, download)
        headers["Accept-Ranges"] = "bytes"

        range_header = request.headers.get("Range")
        if range_header:
            start, end = self._parse_range(range_header, file_size)
            length = end - start + 1

            try:
                content = await hass.async_add_executor_job(client.read_file_range, path, start, length)
            except ValueError as err:
                raise web.HTTPBadRequest(text=str(err)) from err
            except Exception as err:
                raise web.HTTPInternalServerError(text=str(err)) from err

            actual_end = start + len(content) - 1
            headers["Content-Range"] = f"bytes {start}-{actual_end}/{file_size}"
            headers["Content-Length"] = str(len(content))
            return web.Response(
                body=content,
                status=206,
                content_type=content_type,
                headers=headers,
            )

        try:
            content = await hass.async_add_executor_job(client.read_file, path)
        except ValueError as err:
            raise web.HTTPBadRequest(text=str(err)) from err
        except Exception as err:
            raise web.HTTPInternalServerError(text=str(err)) from err

        headers["Content-Length"] = str(len(content))
        return web.Response(body=content, content_type=content_type, headers=headers)

    @staticmethod
    def _headers(filename: str, download: bool) -> dict[str, str]:
        return {
            "Content-Disposition": f'{"attachment" if download else "inline"}; filename="{filename}"',
            "Cache-Control": "no-store",
        }

    @staticmethod
    def _parse_range(range_header: str, file_size: int) -> tuple[int, int]:
        match = RANGE_PATTERN.match(range_header)
        if not match or file_size < 1:
            raise web.HTTPRequestRangeNotSatisfiable(headers={"Content-Range": f"bytes */{file_size}"})

        start_raw, end_raw = match.groups()
        if not start_raw and not end_raw:
            raise web.HTTPRequestRangeNotSatisfiable(headers={"Content-Range": f"bytes */{file_size}"})

        if start_raw:
            start = int(start_raw)
            if end_raw:
                end = min(int(end_raw), file_size - 1)
            else:
                end = min(start + DEFAULT_RANGE_CHUNK_SIZE - 1, file_size - 1)
        else:
            suffix_length = int(end_raw)
            if suffix_length < 1:
                raise web.HTTPRequestRangeNotSatisfiable(headers={"Content-Range": f"bytes */{file_size}"})
            start = max(file_size - suffix_length, 0)
            end = file_size - 1

        if start >= file_size or start > end:
            raise web.HTTPRequestRangeNotSatisfiable(headers={"Content-Range": f"bytes */{file_size}"})

        return start, end
