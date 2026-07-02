"""Samba Explorer integration."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, PANEL_ICON, PANEL_TITLE, PANEL_URL
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
    if DOMAIN in hass.data and hass.data[DOMAIN].get("panel_registered"):
        return

    panel_path = Path(__file__).parent / "panel"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_STATIC_URL, str(panel_path), cache_headers=False)]
    )

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="samba-explorer-panel",
        frontend_url_path=PANEL_URL.strip("/"),
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=PANEL_JS,
        embed_iframe=False,
        require_admin=True,
    )
    hass.data.setdefault(DOMAIN, {})["panel_registered"] = True
