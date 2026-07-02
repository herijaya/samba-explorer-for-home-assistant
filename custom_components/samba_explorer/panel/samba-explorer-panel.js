class SambaExplorerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.entries = [];
    this.entryId = "";
    this.path = "/";
    this.items = [];
    this.loading = false;
    this.error = "";
    this.loadedEntries = false;
    this.previewItem = null;
    this.previewUrl = "";
    this.previewError = "";
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.loadedEntries) {
      this.loadedEntries = true;
      this.loadEntries();
    }
  }

  connectedCallback() {
    this.render();
  }

  async loadEntries() {
    if (!this._hass) return;

    this.loading = true;
    this.error = "";
    this.render();

    try {
      const response = await this._hass.callWS({
        type: "samba_explorer/list_entries",
      });
      this.entries = response || [];
      this.entryId = this.entries[0]?.entry_id || "";
      await this.loadDirectory("/");
    } catch (err) {
      this.error = err?.message || "Unable to load Samba Explorer connections.";
      this.loading = false;
      this.render();
    }
  }

  async loadDirectory(path) {
    if (!this._hass || !this.entryId) {
      this.loading = false;
      this.render();
      return;
    }

    this.loading = true;
    this.error = "";
    this.render();

    try {
      const response = await this._hass.callWS({
        type: "samba_explorer/list_directory",
        entry_id: this.entryId,
        path,
      });
      this.path = response.path || path;
      this.items = response.items || [];
    } catch (err) {
      this.error = err?.message || "Unable to list this folder.";
    } finally {
      this.loading = false;
      this.render();
    }
  }

  parentPath() {
    if (this.path === "/") return "/";
    const parts = this.path.split("/").filter(Boolean);
    parts.pop();
    return parts.length ? `/${parts.join("/")}` : "/";
  }

  formatSize(size) {
    if (!size) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = size;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  formatDate(timestamp) {
    if (!timestamp) return "";
    return new Date(timestamp * 1000).toLocaleString();
  }

  escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  fileKind(name) {
    const ext = name.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
    if (["mp4", "webm", "ogg", "ogv", "mov", "m4v", "mkv"].includes(ext)) return "video";
    if (["mp3", "wav", "flac", "m4a", "aac", "oga", "opus"].includes(ext)) return "audio";
    if (ext === "pdf") return "pdf";
    if (["txt", "log", "csv", "json", "yaml", "yml", "md", "xml"].includes(ext)) return "text";
    return "file";
  }

  async signedFileUrl(item, download = false) {
    const path = `/api/samba_explorer/file/${encodeURIComponent(this.entryId)}?path=${encodeURIComponent(item.path)}${
      download ? "&download=1" : ""
    }`;
    const response = await this._hass.callWS({
      type: "auth/sign_path",
      path,
    });
    return response.path || response;
  }

  async openPreview(item) {
    if (item.is_dir) return;

    this.previewItem = item;
    this.previewUrl = "";
    this.previewError = "";
    this.render();

    try {
      this.previewUrl = await this.signedFileUrl(item);
    } catch (err) {
      this.previewError = err?.message || "Unable to open this file.";
    }
    this.render();
  }

  closePreview() {
    this.previewItem = null;
    this.previewUrl = "";
    this.previewError = "";
    this.render();
  }

  render() {
    const hasEntries = this.entries.length > 0;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100vh;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
        }

        .page {
          max-width: 1120px;
          margin: 0 auto;
          padding: 24px;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 500;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        select,
        button {
          min-height: 40px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          padding: 0 12px;
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          cursor: default;
          opacity: 0.55;
        }

        .path {
          display: flex;
          align-items: center;
          min-height: 40px;
          margin-bottom: 12px;
          padding: 0 12px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--card-background-color);
          font-family: monospace;
          overflow-wrap: anywhere;
        }

        .message {
          padding: 16px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--card-background-color);
        }

        .error {
          border-color: var(--error-color);
          color: var(--error-color);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          overflow: hidden;
        }

        th,
        td {
          padding: 12px;
          border-bottom: 1px solid var(--divider-color);
          text-align: left;
          font-size: 14px;
        }

        th {
          font-weight: 500;
          color: var(--secondary-text-color);
        }

        tr:last-child td {
          border-bottom: 0;
        }

        tr.folder {
          cursor: pointer;
        }

        tr.folder:hover {
          background: rgba(3, 169, 244, 0.08);
        }

        .name {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .icon {
          width: 42px;
          text-align: center;
          color: var(--secondary-text-color);
          font-size: 12px;
        }

        tr.file {
          cursor: pointer;
        }

        tr.file:hover {
          background: rgba(3, 169, 244, 0.05);
        }

        .preview-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.62);
        }

        .preview {
          width: min(1100px, 100%);
          max-height: calc(100vh - 48px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 6px;
          background: var(--card-background-color);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--divider-color);
        }

        .preview-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }

        .preview-actions {
          display: flex;
          gap: 8px;
        }

        .preview-body {
          min-height: 240px;
          max-height: calc(100vh - 130px);
          overflow: auto;
          padding: 16px;
          background: var(--primary-background-color);
        }

        .preview-body img,
        .preview-body video {
          display: block;
          max-width: 100%;
          max-height: calc(100vh - 180px);
          margin: 0 auto;
        }

        .preview-body audio {
          width: 100%;
        }

        .preview-body iframe {
          width: 100%;
          height: calc(100vh - 180px);
          border: 0;
          background: white;
        }

        .preview-note {
          color: var(--secondary-text-color);
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
          }

          .toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            width: 100%;
          }

          select {
            min-width: 0;
            width: 100%;
          }

          button {
            min-width: 72px;
            padding: 0 10px;
          }

          th:nth-child(2),
          td:nth-child(2) {
            display: none;
          }

          .preview-backdrop {
            align-items: stretch;
            padding: 8px;
          }

          .preview-body {
            max-height: calc(100vh - 100px);
          }
        }
      </style>

      <div class="page">
        <div class="toolbar">
          <h1>Samba Explorer</h1>
          <div class="actions">
            <select ${!hasEntries ? "disabled" : ""} id="entry-select">
              ${
                hasEntries
                  ? this.entries
                      .map(
                        (entry) =>
                          `<option value="${entry.entry_id}" ${
                            entry.entry_id === this.entryId ? "selected" : ""
                          }>${this.escapeHtml(entry.title)}</option>`
                      )
                      .join("")
                  : '<option>No SMB connection</option>'
              }
            </select>
            <button id="up-button" ${this.path === "/" || this.loading ? "disabled" : ""}>Up</button>
            <button id="refresh-button" ${this.loading || !hasEntries ? "disabled" : ""}>Refresh</button>
          </div>
        </div>

        <div class="path">${this.path}</div>

        ${this.error ? `<div class="message error">${this.error}</div>` : ""}
        ${!hasEntries && !this.loading && !this.error ? `<div class="message">Add an SMB connection from Settings &gt; Devices &amp; services.</div>` : ""}
        ${this.loading ? `<div class="message">Loading...</div>` : this.renderTable()}
        ${this.renderPreview()}
      </div>
    `;

    this.shadowRoot.getElementById("entry-select")?.addEventListener("change", (event) => {
      this.entryId = event.target.value;
      this.loadDirectory("/");
    });
    this.shadowRoot.getElementById("up-button")?.addEventListener("click", () => this.loadDirectory(this.parentPath()));
    this.shadowRoot.getElementById("refresh-button")?.addEventListener("click", () => this.loadDirectory(this.path));
    this.shadowRoot.querySelectorAll("tr.folder").forEach((row) => {
      row.addEventListener("click", () => this.loadDirectory(row.dataset.path));
    });
    this.shadowRoot.querySelectorAll("tr.file").forEach((row) => {
      const item = this.items.find((candidate) => candidate.path === row.dataset.path);
      row.addEventListener("click", () => item && this.openPreview(item));
    });
    this.shadowRoot.getElementById("close-preview")?.addEventListener("click", () => this.closePreview());
    this.shadowRoot.getElementById("download-preview")?.addEventListener("click", async () => {
      if (!this.previewItem) return;
      window.open(await this.signedFileUrl(this.previewItem, true), "_blank", "noopener");
    });
  }

  renderTable() {
    if (!this.entries.length) return "";
    if (!this.items.length) return `<div class="message">This folder is empty.</div>`;

    return `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Modified</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          ${this.items
            .map(
              (item) => `
                <tr class="${item.is_dir ? "folder" : "file"}" data-path="${item.path}">
                  <td>
                    <div class="name">
                      <span class="icon">${item.is_dir ? "DIR" : this.fileKind(item.name).toUpperCase()}</span>
                      <span>${this.escapeHtml(item.name)}</span>
                    </div>
                  </td>
                  <td>${this.formatDate(item.modified)}</td>
                  <td>${item.is_dir ? "" : this.formatSize(item.size)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  renderPreview() {
    if (!this.previewItem) return "";
    const kind = this.fileKind(this.previewItem.name);
    const body = this.previewBody(kind);

    return `
      <div class="preview-backdrop">
        <div class="preview">
          <div class="preview-header">
            <div class="preview-title">${this.escapeHtml(this.previewItem.name)}</div>
            <div class="preview-actions">
              <button id="download-preview">Download</button>
              <button id="close-preview">Close</button>
            </div>
          </div>
          <div class="preview-body">
            ${this.previewError ? `<div class="message error">${this.previewError}</div>` : body}
          </div>
        </div>
      </div>
    `;
  }

  previewBody(kind) {
    if (!this.previewUrl) return `<div class="message">Opening file...</div>`;

    if (kind === "image") {
      return `<img src="${this.previewUrl}" alt="${this.escapeHtml(this.previewItem.name)}">`;
    }
    if (kind === "video") {
      return `<video src="${this.previewUrl}" controls autoplay playsinline></video>`;
    }
    if (kind === "audio") {
      return `<audio src="${this.previewUrl}" controls autoplay></audio>`;
    }
    if (kind === "pdf" || kind === "text") {
      return `<iframe src="${this.previewUrl}"></iframe>`;
    }

    return `
      <div class="message">
        <div>This file type cannot be previewed yet.</div>
        <div class="preview-note">Use Download to open it outside Home Assistant.</div>
      </div>
    `;
  }
}

customElements.define("samba-explorer-panel", SambaExplorerPanel);
