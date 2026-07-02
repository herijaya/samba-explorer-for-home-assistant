"""SMB client helpers for Samba Explorer."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePosixPath
from socket import gethostname
from typing import Any

from smb.SMBConnection import SMBConnection

from homeassistant.const import CONF_HOST, CONF_PASSWORD, CONF_PORT, CONF_USERNAME

from .const import CONF_BASE_PATH, CONF_DOMAIN, CONF_SHARE, DEFAULT_BASE_PATH


DEFAULT_SMB_PORT = 445


@dataclass(slots=True)
class SmbEntryConfig:
    """Connection settings for one SMB share."""

    host: str
    share: str
    username: str
    password: str
    domain: str
    base_path: str = DEFAULT_BASE_PATH
    port: int = DEFAULT_SMB_PORT

    @classmethod
    def from_mapping(cls, data: dict[str, Any]) -> "SmbEntryConfig":
        """Build config from Home Assistant config entry data."""
        return cls(
            host=data[CONF_HOST],
            share=data[CONF_SHARE],
            username=data[CONF_USERNAME],
            password=data[CONF_PASSWORD],
            domain=data[CONF_DOMAIN],
            base_path=data.get(CONF_BASE_PATH, DEFAULT_BASE_PATH),
            port=int(data.get(CONF_PORT, DEFAULT_SMB_PORT)),
        )


class SambaExplorerClient:
    """Small wrapper around pysmb with path normalization."""

    def __init__(self, config: SmbEntryConfig) -> None:
        self._config = config

    def test_connection(self) -> None:
        """Open and close a connection to validate credentials."""
        conn = self._connect()
        conn.close()

    def list_directory(self, path: str = "/") -> list[dict[str, Any]]:
        """Return files and folders for a directory inside the configured base path."""
        conn = self._connect()
        try:
            normalized_path = self._safe_path(path)
            items = conn.listPath(self._config.share, normalized_path)
            result = []
            for item in items:
                if item.filename in {".", ".."}:
                    continue

                result.append(
                    {
                        "name": item.filename,
                        "path": self._join_browser_path(path, item.filename),
                        "is_dir": item.isDirectory,
                        "size": 0 if item.isDirectory else item.file_size,
                        "modified": item.last_write_time,
                    }
                )

            return sorted(result, key=lambda row: (not row["is_dir"], row["name"].lower()))
        finally:
            conn.close()

    def read_file(self, path: str) -> bytes:
        """Read a file from the configured share."""
        conn = self._connect()
        try:
            normalized_path = self._safe_path(path)
            output = BytesIO()
            conn.retrieveFile(self._config.share, normalized_path, output)
            return output.getvalue()
        finally:
            conn.close()

    def get_file_size(self, path: str) -> int:
        """Return the size of a file in bytes."""
        conn = self._connect()
        try:
            normalized_path = self._safe_path(path)
            return conn.getAttributes(self._config.share, normalized_path).file_size
        finally:
            conn.close()

    def read_file_range(self, path: str, offset: int, length: int) -> bytes:
        """Read a byte range from a file."""
        conn = self._connect()
        try:
            normalized_path = self._safe_path(path)
            output = BytesIO()
            conn.retrieveFileFromOffset(
                self._config.share,
                normalized_path,
                output,
                offset=offset,
                max_length=length,
            )
            return output.getvalue()
        finally:
            conn.close()

    def _connect(self) -> SMBConnection:
        conn = SMBConnection(
            self._config.username,
            self._config.password,
            gethostname(),
            self._config.host,
            domain=self._config.domain,
            use_ntlm_v2=True,
            is_direct_tcp=True,
        )
        conn.connect(self._config.host, self._config.port)
        return conn

    def _safe_path(self, user_path: str) -> str:
        base = str(self._normalize_base_path(self._config.base_path))
        requested = self._normalize_browser_path(user_path)
        combined = PurePosixPath(base, requested.relative_to("/"))
        normalized = str(self._normalize_browser_path(str(combined)))

        if base != "/" and not (normalized == base or normalized.startswith(f"{base}/")):
            raise ValueError("Path is outside configured base path")

        return normalized

    @staticmethod
    def _normalize_base_path(path: str) -> str:
        normalized = SambaExplorerClient._normalize_browser_path(path)
        return normalized

    @staticmethod
    def _normalize_browser_path(path: str) -> PurePosixPath:
        raw = path or "/"
        normalized = PurePosixPath("/", raw)
        parts = []
        for part in normalized.parts:
            if part in {"", "/"}:
                continue
            if part == "..":
                if parts:
                    parts.pop()
                continue
            if part != ".":
                parts.append(part)
        return PurePosixPath("/", *parts)

    @staticmethod
    def _join_browser_path(current_path: str, filename: str) -> str:
        return str(SambaExplorerClient._normalize_browser_path(str(PurePosixPath(current_path, filename))))
