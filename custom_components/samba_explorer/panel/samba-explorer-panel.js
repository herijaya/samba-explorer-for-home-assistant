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
        type: "config_entries/get_entries",
        domain: "samba_explorer",
      });
      this.entries = response || [];
      this.entryId = this.entries[0]?.entry_id || "";
      await this.loadDirectory("/");
    } catch (err) {
      this.error = err?.message || "Unable to load Samba Explorer entries.";
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
          width: 22px;
          text-align: center;
        }

        @media (max-width: 720px) {
          .page {
            padding: 16px;
          }

          .toolbar,
          .actions {
            align-items: stretch;
            flex-direction: column;
          }

          .actions,
          select,
          button {
            width: 100%;
          }

          th:nth-child(2),
          td:nth-child(2) {
            display: none;
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
                          }>${entry.title}</option>`
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
        ${!hasEntries && !this.loading ? `<div class="message">Add an SMB connection from Settings &gt; Devices &amp; services.</div>` : ""}
        ${this.loading ? `<div class="message">Loading...</div>` : this.renderTable()}
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
                <tr class="${item.is_dir ? "folder" : ""}" data-path="${item.path}">
                  <td>
                    <div class="name">
                      <span class="icon">${item.is_dir ? "DIR" : "FILE"}</span>
                      <span>${item.name}</span>
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
}

customElements.define("samba-explorer-panel", SambaExplorerPanel);
