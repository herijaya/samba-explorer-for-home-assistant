class SambaExplorerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.entries = [];
    this.entryId = "";
    this.path = "/";
    this.items = [];
    this.page = 0;
    this.pageSize = 50;
    this.loading = false;
    this.error = "";
    this.loadedEntries = false;
    this.previewItem = null;
    this.previewUrl = "";
    this.previewError = "";
    this.previewRequestId = 0;
    this.cardMode = false;
    this.config = {};
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

  disconnectedCallback() {
    window.removeEventListener("keydown", this.boundKeydown);
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
      const configuredEntryId = this.config.entry_id;
      const configuredEntry = this.entries.find((entry) => entry.entry_id === configuredEntryId);
      this.entryId = configuredEntry?.entry_id || this.entries[0]?.entry_id || "";
      await this.loadDirectory(this.config.path || "/");
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
      this.page = 0;
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

    const requestId = this.previewRequestId + 1;
    this.previewRequestId = requestId;
    this.previewItem = item;
    this.previewUrl = "";
    this.previewError = "";
    this.render();

    try {
      const previewUrl = await this.signedFileUrl(item);
      if (this.previewRequestId !== requestId || !this.previewItem) return;
      this.previewUrl = previewUrl;
    } catch (err) {
      if (this.previewRequestId !== requestId || !this.previewItem) return;
      this.previewError = err?.message || "Unable to open this file.";
    }
    this.render();
  }

  closePreview() {
    this.previewRequestId += 1;
    this.shadowRoot.querySelectorAll("video, audio, iframe, img").forEach((element) => {
      element.removeAttribute("src");
      if (typeof element.load === "function") element.load();
    });
    this.previewItem = null;
    this.previewUrl = "";
    this.previewError = "";
    this.render();
  }

  handleKeydown(event) {
    if (event.key === "Escape" && this.previewItem) {
      this.closePreview();
    }
  }

  title() {
    return this.config.title || "Samba Explorer";
  }

  totalPages() {
    return Math.max(Math.ceil(this.items.length / this.pageSize), 1);
  }

  currentPageItems() {
    const start = this.page * this.pageSize;
    return this.items.slice(start, start + this.pageSize);
  }

  setPage(page) {
    this.page = Math.max(0, Math.min(page, this.totalPages() - 1));
    this.render();
  }

  render() {
    const hasEntries = this.entries.length > 0;
    const outerStart = this.cardMode ? "<ha-card>" : "";
    const outerEnd = this.cardMode ? "</ha-card>" : "";
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: ${this.cardMode ? "0" : "100vh"};
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
          --se-surface: var(--card-background-color);
          --se-border: color-mix(in srgb, var(--divider-color), transparent 18%);
          --se-hover: color-mix(in srgb, var(--primary-color) 10%, transparent);
          --se-muted: var(--secondary-text-color);
        }

        ha-card {
          overflow: hidden;
          border-radius: var(--ha-card-border-radius, 8px);
        }

        .page {
          max-width: ${this.cardMode ? "none" : "1120px"};
          margin: ${this.cardMode ? "0" : "0 auto"};
          padding: ${this.cardMode ? "16px" : "28px"};
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }

        h1 {
          margin: 0;
          font-size: ${this.cardMode ? "20px" : "26px"};
          font-weight: 650;
          line-height: 1.15;
          letter-spacing: 0;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: min(100%, 520px);
        }

        select,
        button {
          min-height: 38px;
          border: 1px solid var(--se-border);
          border-radius: 8px;
          background: var(--se-surface);
          color: var(--primary-text-color);
          padding: 0 14px;
          font: inherit;
          transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
        }

        select {
          flex: 1 1 260px;
          min-width: 180px;
          appearance: auto;
        }

        button {
          cursor: pointer;
          font-weight: 600;
          white-space: nowrap;
        }

        button:hover:not(:disabled),
        select:hover:not(:disabled) {
          border-color: color-mix(in srgb, var(--primary-color) 45%, var(--se-border));
          background: color-mix(in srgb, var(--primary-color) 6%, var(--se-surface));
        }

        button:active:not(:disabled) {
          transform: translateY(1px);
        }

        button:disabled {
          cursor: default;
          opacity: 0.55;
        }

        .path {
          display: flex;
          align-items: center;
          min-height: 40px;
          margin-bottom: 14px;
          padding: 0 14px;
          border: 1px solid var(--se-border);
          border-radius: 8px;
          background: color-mix(in srgb, var(--se-surface) 88%, var(--primary-background-color));
          color: var(--se-muted);
          font-family: monospace;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .pager {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          color: var(--se-muted);
          font-size: 13px;
        }

        .pager-actions {
          display: flex;
          gap: 8px;
        }

        .message {
          padding: 16px;
          border: 1px solid var(--se-border);
          border-radius: 8px;
          background: var(--se-surface);
        }

        .error {
          border-color: var(--error-color);
          color: var(--error-color);
        }

        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          background: var(--se-surface);
          border: 1px solid var(--se-border);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        th,
        td {
          padding: 11px 14px;
          border-bottom: 1px solid var(--se-border);
          text-align: left;
          font-size: 14px;
        }

        th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: color-mix(in srgb, var(--se-surface) 92%, var(--primary-background-color));
          font-size: 12px;
          font-weight: 700;
          color: var(--se-muted);
          text-transform: uppercase;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        tr.folder {
          cursor: pointer;
        }

        tr.folder:hover,
        tr.file:hover {
          background: var(--se-hover);
        }

        .name {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .icon {
          width: 48px;
          min-width: 48px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: color-mix(in srgb, var(--primary-color) 10%, transparent);
          text-align: center;
          color: var(--se-muted);
          font-size: 11px;
          font-weight: 700;
        }

        tr.file {
          cursor: pointer;
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
          border: 1px solid var(--se-border);
          border-radius: 8px;
          background: var(--se-surface);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--se-border);
        }

        .preview-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 650;
        }

        .preview-actions {
          display: flex;
          gap: 8px;
        }

        .preview-close {
          width: 38px;
          min-width: 38px;
          padding: 0;
          font-size: 20px;
          line-height: 1;
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
            padding: ${this.cardMode ? "12px" : "16px"};
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
            min-width: 46px;
            padding: 0 10px;
          }

          .pager {
            align-items: stretch;
            flex-direction: column;
            gap: 8px;
          }

          .pager-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
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

      ${outerStart}
        <div class="page">
          <div class="toolbar">
            <h1>${this.escapeHtml(this.title())}</h1>
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
              <button id="up-button" title="Up" aria-label="Up" ${this.path === "/" || this.loading ? "disabled" : ""}>Up</button>
              <button id="refresh-button" title="Refresh" aria-label="Refresh" ${this.loading || !hasEntries ? "disabled" : ""}>Reload</button>
            </div>
          </div>

          <div class="path">${this.path}</div>

          ${this.error ? `<div class="message error">${this.error}</div>` : ""}
          ${!hasEntries && !this.loading && !this.error ? `<div class="message">Add an SMB connection from Settings &gt; Devices &amp; services.</div>` : ""}
          ${this.loading ? `<div class="message">Loading...</div>` : this.renderTable()}
          ${this.renderPager()}
          ${this.renderPreview()}
        </div>
      ${outerEnd}
    `;

    this.shadowRoot.getElementById("entry-select")?.addEventListener("change", (event) => {
      this.entryId = event.target.value;
      this.loadDirectory("/");
    });
    this.shadowRoot.getElementById("up-button")?.addEventListener("click", () => this.loadDirectory(this.parentPath()));
    this.shadowRoot.getElementById("refresh-button")?.addEventListener("click", () => this.loadDirectory(this.path));
    this.shadowRoot.querySelectorAll("[data-page-action='prev']").forEach((button) => {
      button.addEventListener("click", () => this.setPage(this.page - 1));
    });
    this.shadowRoot.querySelectorAll("[data-page-action='next']").forEach((button) => {
      button.addEventListener("click", () => this.setPage(this.page + 1));
    });
    this.shadowRoot.querySelectorAll("tr.folder").forEach((row) => {
      row.addEventListener("click", () => this.loadDirectory(row.dataset.path));
    });
    this.shadowRoot.querySelectorAll("tr.file").forEach((row) => {
      const item = this.items.find((candidate) => candidate.path === row.dataset.path);
      row.addEventListener("click", () => item && this.openPreview(item));
    });
    this.shadowRoot.getElementById("close-preview")?.addEventListener("click", () => this.closePreview());
    this.shadowRoot.querySelector(".preview-backdrop")?.addEventListener("click", (event) => {
      if (event.target.classList.contains("preview-backdrop")) this.closePreview();
    });
    if (!this.boundKeydown) {
      this.boundKeydown = (event) => this.handleKeydown(event);
      window.addEventListener("keydown", this.boundKeydown);
    }
  }

  renderTable() {
    if (!this.entries.length) return "";
    if (!this.items.length) return `<div class="message">This folder is empty.</div>`;
    const rows = this.currentPageItems();

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
          ${rows
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

  renderPager() {
    if (this.loading || this.items.length <= this.pageSize) return "";

    const start = this.page * this.pageSize + 1;
    const end = Math.min((this.page + 1) * this.pageSize, this.items.length);
    return `
      <div class="pager">
        <div>Showing ${start}-${end} of ${this.items.length}</div>
        <div class="pager-actions">
          <button data-page-action="prev" ${this.page === 0 ? "disabled" : ""}>Prev</button>
          <button data-page-action="next" ${this.page >= this.totalPages() - 1 ? "disabled" : ""}>Next</button>
        </div>
      </div>
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
              <button class="preview-close" id="close-preview" title="Close" aria-label="Close">x</button>
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
      return `<video src="${this.previewUrl}" controls autoplay playsinline preload="metadata"></video>`;
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
        <div class="preview-note">This file can be opened from the browser context menu if supported.</div>
      </div>
    `;
  }
}

customElements.define("samba-explorer-panel", SambaExplorerPanel);

class SambaExplorerCard extends SambaExplorerPanel {
  constructor() {
    super();
    this.cardMode = true;
  }

  setConfig(config) {
    this.config = config || {};
    if (this.loadedEntries) {
      this.loadedEntries = false;
      this.loadEntries();
    }
  }

  getCardSize() {
    return 8;
  }

  static getStubConfig() {
    return {
      title: "Samba Explorer",
      path: "/",
    };
  }
}

customElements.define("samba-explorer-card", SambaExplorerCard);
