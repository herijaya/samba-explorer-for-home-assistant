"""Samba Explorer integration."""

from __future__ import annotations

from asyncio import Lock
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_PANEL_ADMIN_ONLY,
    DEFAULT_PANEL_ADMIN_ONLY,
    DOMAIN,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
)
from .http import SambaExplorerFileView
from .websocket_api import async_register_websocket_api

PANEL_STATIC_URL = "/samba_explorer_static"
PANEL_JS = f"{PANEL_STATIC_URL}/samba-explorer-panel.js"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Samba Explorer."""
    hass.data.setdefault(DOMAIN, {})
    async_register_websocket_api(hass)
    hass.http.register_view(SambaExplorerFileView())
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Samba Explorer from a config entry."""
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = entry.data
    await _async_register_panel(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Samba Explorer config entry."""
    hass.data.setdefault(DOMAIN, {}).pop(entry.entry_id, None)
    return True


async def _async_register_panel(hass: HomeAssistant) -> None:
    data = hass.data.setdefault(DOMAIN, {})
    lock = data.setdefault("panel_lock", Lock())

    async with lock:
        require_admin = _panel_require_admin(hass)

        if not data.get("static_registered"):
            panel_path = Path(__file__).parent / "panel"
            await hass.http.async_register_static_paths(
                [StaticPathConfig(PANEL_STATIC_URL, str(panel_path), cache_headers=False)]
            )
            data["static_registered"] = True

        frontend.async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            frontend_url_path=PANEL_URL.strip("/"),
            config={
                "_panel_custom": {
                    "name": "samba-explorer-panel",
                    "module_url": PANEL_JS,
                    "embed_iframe": False,
                    "trust_external": False,
                }
            },
            require_admin=require_admin,
            update=True,
        )
        data["panel_registered"] = True
        data["panel_require_admin"] = require_admin


def _panel_require_admin(hass: HomeAssistant) -> bool:
    """Return whether the sidebar panel should require admin access."""
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return DEFAULT_PANEL_ADMIN_ONLY

    return all(
        entry.data.get(CONF_PANEL_ADMIN_ONLY, DEFAULT_PANEL_ADMIN_ONLY)
        for entry in entries
    )
