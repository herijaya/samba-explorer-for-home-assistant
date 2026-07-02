"""Config flow for Samba Explorer."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME
from homeassistant.core import HomeAssistant

from .const import (
    CONF_BASE_PATH,
    CONF_DOMAIN,
    CONF_NAME,
    CONF_SHARE,
    DEFAULT_BASE_PATH,
    DEFAULT_DOMAIN,
    DEFAULT_NAME,
    DOMAIN,
)
from .smb_client import DEFAULT_SMB_PORT, SambaExplorerClient, SmbEntryConfig


def _schema(defaults: dict[str, Any] | None = None) -> vol.Schema:
    defaults = defaults or {}
    return vol.Schema(
        {
            vol.Required(CONF_NAME, default=defaults.get(CONF_NAME, DEFAULT_NAME)): str,
            vol.Required(CONF_HOST, default=defaults.get(CONF_HOST, "")): str,
            vol.Required(CONF_SHARE, default=defaults.get(CONF_SHARE, "")): str,
            vol.Required(CONF_USERNAME, default=defaults.get(CONF_USERNAME, "")): str,
            vol.Required(CONF_PASSWORD, default=defaults.get(CONF_PASSWORD, "")): str,
            vol.Optional(CONF_DOMAIN, default=defaults.get(CONF_DOMAIN, DEFAULT_DOMAIN)): str,
            vol.Optional(CONF_BASE_PATH, default=defaults.get(CONF_BASE_PATH, DEFAULT_BASE_PATH)): str,
            vol.Optional(CONF_PORT, default=defaults.get(CONF_PORT, DEFAULT_SMB_PORT)): int,
        }
    )


async def _validate_input(hass: HomeAssistant, data: dict[str, Any]) -> None:
    config = SmbEntryConfig.from_mapping(data)
    client = SambaExplorerClient(config)
    await hass.async_add_executor_job(client.test_connection)


def _entry_title(data: dict[str, Any]) -> str:
    return data.get(CONF_NAME) or f"{data[CONF_HOST]}/{data[CONF_SHARE]}"


class SambaExplorerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle Samba Explorer setup."""

    VERSION = 1

    @staticmethod
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> config_entries.OptionsFlow:
        """Create the options flow for an existing entry."""
        return SambaExplorerOptionsFlow(config_entry)

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        errors: dict[str, str] = {}

        if user_input is not None:
            await self.async_set_unique_id(
                f"{user_input[CONF_HOST]}:{user_input.get(CONF_PORT, DEFAULT_SMB_PORT)}/{user_input[CONF_SHARE]}"
            )
            self._abort_if_unique_id_configured()

            try:
                await _validate_input(self.hass, user_input)
            except Exception:
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(title=_entry_title(user_input), data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=_schema(user_input),
            errors=errors,
        )


class SambaExplorerOptionsFlow(config_entries.OptionsFlow):
    """Handle Samba Explorer reconfiguration."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        """Show the SMB connection form again for an existing entry."""
        errors: dict[str, str] = {}
        defaults = dict(self.config_entry.data)

        if user_input is not None:
            updated_data = {**defaults, **user_input}

            try:
                await _validate_input(self.hass, updated_data)
            except Exception:
                errors["base"] = "cannot_connect"
            else:
                self.hass.config_entries.async_update_entry(
                    self.config_entry,
                    title=_entry_title(updated_data),
                    data=updated_data,
                )
                await self.hass.config_entries.async_reload(self.config_entry.entry_id)
                return self.async_create_entry(title="", data={})

        return self.async_show_form(
            step_id="init",
            data_schema=_schema(user_input or defaults),
            errors=errors,
        )
