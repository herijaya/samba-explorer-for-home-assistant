"""WebSocket API for Samba Explorer."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN, CONF_HOST, CONF_SHARE, WS_LIST_DIRECTORY, WS_LIST_ENTRIES
from .smb_client import SambaExplorerClient, SmbEntryConfig


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register Samba Explorer websocket commands."""
    websocket_api.async_register_command(hass, websocket_list_entries)
    websocket_api.async_register_command(hass, websocket_list_directory)


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_LIST_ENTRIES,
    }
)
@websocket_api.async_response
async def websocket_list_entries(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Return configured Samba Explorer entries for the panel."""
    entries = [
        {
            "entry_id": entry.entry_id,
            "title": entry.title,
            "host": entry.data.get(CONF_HOST, ""),
            "share": entry.data.get(CONF_SHARE, ""),
        }
        for entry in hass.config_entries.async_entries(DOMAIN)
    ]
    connection.send_result(msg["id"], entries)


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_LIST_DIRECTORY,
        vol.Required("entry_id"): str,
        vol.Optional("path", default="/"): str,
    }
)
@websocket_api.async_response
async def websocket_list_directory(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """List a directory from one configured SMB entry."""
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    if entry is None or entry.domain != DOMAIN:
        connection.send_error(msg["id"], "not_found", "Samba Explorer entry not found")
        return

    client = SambaExplorerClient(SmbEntryConfig.from_mapping(entry.data))

    try:
        items = await hass.async_add_executor_job(client.list_directory, msg["path"])
    except Exception as err:
        connection.send_error(msg["id"], "list_failed", str(err))
        return

    connection.send_result(
        msg["id"],
        {
            "entry_id": msg["entry_id"],
            "path": msg["path"],
            "items": items,
        },
    )
