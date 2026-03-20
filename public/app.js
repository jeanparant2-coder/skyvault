const state = {
  currentPath: "",
  items: [],
  selectedPath: "",
  search: "",
  viewMode: "grid",
};

const refs = {
  breadcrumb: document.getElementById("breadcrumb"),
  itemsContainer: document.getElementById("itemsContainer"),
  emptyState: document.getElementById("emptyState"),
  searchInput: document.getElementById("searchInput"),
  viewToggleButton: document.getElementById("viewToggleButton"),
  uploadButton: document.getElementById("uploadButton"),
  newFolderButton: document.getElementById("newFolderButton"),
  renameButton: document.getElementById("renameButton"),
  deleteButton: document.getElementById("deleteButton"),
  fileInput: document.getElementById("fileInput"),
  storageLabel: document.getElementById("storageLabel"),
  storageFill: document.getElementById("storageFill"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalTitle: document.getElementById("modalTitle"),
  modalDescription: document.getElementById("modalDescription"),
  modalInput: document.getElementById("modalInput"),
  modalCancel: document.getElementById("modalCancel"),
  modalConfirm: document.getElementById("modalConfirm"),
  toast: document.getElementById("toast"),
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }

  const units = ["o", "Ko", "Mo", "Go", "To"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function showToast(message, type = "info") {
  refs.toast.textContent = message;
  refs.toast.className = type === "error" ? "toast error" : "toast";
  refs.toast.hidden = false;

  setTimeout(() => {
    refs.toast.hidden = true;
  }, 2200);
}

function debounce(fn, delayMs) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let errorMessage = `Erreur API (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && payload.error) {
        errorMessage = payload.error;
      }
    } catch {
      // No payload
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function updateActionButtons() {
  const hasSelection = Boolean(state.selectedPath);
  refs.renameButton.disabled = !hasSelection;
  refs.deleteButton.disabled = !hasSelection;
}

function renderBreadcrumb() {
  const normalized = state.currentPath;
  const segments = normalized ? normalized.split("/") : [];
  refs.breadcrumb.innerHTML = "";

  const rootButton = document.createElement("button");
  rootButton.type = "button";
  rootButton.className = "crumb-button";
  rootButton.textContent = "Racine";
  rootButton.dataset.path = "";
  refs.breadcrumb.appendChild(rootButton);

  let accumulated = "";
  for (const segment of segments) {
    const separator = document.createElement("span");
    separator.textContent = "/";
    refs.breadcrumb.appendChild(separator);

    accumulated = accumulated ? `${accumulated}/${segment}` : segment;
    const segmentButton = document.createElement("button");
    segmentButton.type = "button";
    segmentButton.className = "crumb-button";
    segmentButton.textContent = segment;
    segmentButton.dataset.path = accumulated;
    refs.breadcrumb.appendChild(segmentButton);
  }
}

function renderStorage(stats) {
  if (!stats) {
    return;
  }

  refs.storageLabel.textContent = `${formatBytes(stats.usedBytes)} / ${formatBytes(
    stats.totalBytes
  )}`;
  refs.storageFill.style.width = `${Math.min(100, Number(stats.usagePercent || 0))}%`;
}

function itemMetaLabel(item) {
  if (item.type === "folder") {
    return `Dossier - Modifie le ${new Date(item.updatedAt).toLocaleString("fr-FR")}`;
  }

  return `${formatBytes(item.size)} - Modifie le ${new Date(item.updatedAt).toLocaleString(
    "fr-FR"
  )}`;
}

function renderItems() {
  refs.itemsContainer.className =
    state.viewMode === "grid" ? "items-grid" : "items-grid items-list";
  refs.itemsContainer.innerHTML = "";

  if (state.items.length === 0) {
    refs.emptyState.hidden = false;
    return;
  }

  refs.emptyState.hidden = true;

  for (const item of state.items) {
    const card = document.createElement("article");
    card.className =
      item.relativePath === state.selectedPath ? "item-card item-card--selected" : "item-card";
    card.dataset.path = item.relativePath;
    card.dataset.type = item.type;
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="item-main">
        <div class="item-icon ${item.type === "file" ? "item-icon--file" : ""}">
          ${item.type === "folder" ? "DIR" : "FILE"}
        </div>
        <div class="item-text">
          <p class="item-name">${item.name}</p>
          <p class="item-meta">${itemMetaLabel(item)}</p>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      state.selectedPath = item.relativePath;
      updateActionButtons();
      renderItems();
    });

    card.addEventListener("dblclick", () => {
      if (item.type === "folder") {
        navigateTo(item.relativePath);
      }
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && item.type === "folder") {
        navigateTo(item.relativePath);
      }
    });

    refs.itemsContainer.appendChild(card);
  }
}

async function loadItems() {
  const params = new URLSearchParams();
  if (state.currentPath) {
    params.set("path", state.currentPath);
  }
  if (state.search) {
    params.set("search", state.search);
  }

  const payload = await apiRequest(`/api/items?${params.toString()}`);
  state.currentPath = payload.currentPath || "";
  state.items = payload.items || [];
  if (!state.items.some((item) => item.relativePath === state.selectedPath)) {
    state.selectedPath = "";
  }

  updateActionButtons();
  renderBreadcrumb();
  renderItems();
  renderStorage(payload.stats);
}

async function navigateTo(path) {
  state.currentPath = path || "";
  state.search = "";
  refs.searchInput.value = "";
  state.selectedPath = "";
  await loadItems();
}

function openTextModal({ title, description, defaultValue = "", confirmLabel = "Confirmer" }) {
  return new Promise((resolve) => {
    refs.modalTitle.textContent = title;
    refs.modalDescription.textContent = description;
    refs.modalInput.value = defaultValue;
    refs.modalConfirm.textContent = confirmLabel;
    refs.modalOverlay.hidden = false;
    refs.modalInput.focus();
    refs.modalInput.select();

    function close(value) {
      refs.modalOverlay.hidden = true;
      refs.modalCancel.removeEventListener("click", onCancel);
      refs.modalConfirm.removeEventListener("click", onConfirm);
      refs.modalInput.removeEventListener("keydown", onKeydown);
      resolve(value);
    }

    function onCancel() {
      close(null);
    }

    function onConfirm() {
      close(refs.modalInput.value.trim());
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        close(null);
      }
      if (event.key === "Enter") {
        close(refs.modalInput.value.trim());
      }
    }

    refs.modalCancel.addEventListener("click", onCancel);
    refs.modalConfirm.addEventListener("click", onConfirm);
    refs.modalInput.addEventListener("keydown", onKeydown);
  });
}

async function handleCreateFolder() {
  const name = await openTextModal({
    title: "Nouveau dossier",
    description: "Choisis un nom pour le dossier.",
  });

  if (!name) {
    return;
  }

  await apiRequest("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: state.currentPath,
      name,
    }),
  });

  showToast("Dossier cree.");
  await loadItems();
}

function currentSelectedItem() {
  return state.items.find((item) => item.relativePath === state.selectedPath) || null;
}

async function handleRename() {
  const selectedItem = currentSelectedItem();
  if (!selectedItem) {
    return;
  }

  const newName = await openTextModal({
    title: "Renommer",
    description: "Saisis le nouveau nom.",
    defaultValue: selectedItem.name,
    confirmLabel: "Renommer",
  });

  if (!newName || newName === selectedItem.name) {
    return;
  }

  await apiRequest("/api/items", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: selectedItem.relativePath,
      newName,
    }),
  });

  showToast("Element renomme.");
  state.selectedPath = "";
  await loadItems();
}

async function handleDelete() {
  const selectedItem = currentSelectedItem();
  if (!selectedItem) {
    return;
  }

  const confirmed = window.confirm(
    `Supprimer "${selectedItem.name}" ? Cette action est irreversible.`
  );
  if (!confirmed) {
    return;
  }

  const params = new URLSearchParams({ path: selectedItem.relativePath });
  await apiRequest(`/api/items?${params.toString()}`, {
    method: "DELETE",
  });

  showToast("Element supprime.");
  state.selectedPath = "";
  await loadItems();
}

async function handleUpload(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) {
    return;
  }

  const formData = new FormData();
  formData.append("path", state.currentPath);
  for (const file of files) {
    formData.append("files", file);
  }

  await apiRequest("/api/upload", {
    method: "POST",
    body: formData,
  });

  showToast(`${files.length} fichier(s) envoye(s).`);
  refs.fileInput.value = "";
  await loadItems();
}

function bindEvents() {
  refs.searchInput.addEventListener(
    "input",
    debounce(async (event) => {
      state.search = event.target.value.trim();
      state.selectedPath = "";
      await loadItems();
    }, 260)
  );

  refs.breadcrumb.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-path]");
    if (!button) {
      return;
    }

    await navigateTo(button.dataset.path || "");
  });

  refs.viewToggleButton.addEventListener("click", () => {
    state.viewMode = state.viewMode === "grid" ? "list" : "grid";
    refs.viewToggleButton.textContent =
      state.viewMode === "grid" ? "Vue liste" : "Vue grille";
    renderItems();
  });

  refs.uploadButton.addEventListener("click", () => refs.fileInput.click());
  refs.fileInput.addEventListener("change", (event) => {
    handleUpload(event).catch((error) => showToast(error.message, "error"));
  });
  refs.newFolderButton.addEventListener("click", () => {
    handleCreateFolder().catch((error) => showToast(error.message, "error"));
  });
  refs.renameButton.addEventListener("click", () => {
    handleRename().catch((error) => showToast(error.message, "error"));
  });
  refs.deleteButton.addEventListener("click", () => {
    handleDelete().catch((error) => showToast(error.message, "error"));
  });
}

async function bootstrap() {
  bindEvents();
  await loadItems();
}

bootstrap().catch((error) => {
  showToast(error.message, "error");
});
