(() => {
  "use strict";

  const uploadForm = document.querySelector("#upload-form");
  const fileInput = document.querySelector("#file");
  const dropZone = document.querySelector("#drop-zone");
  const selectedFile = document.querySelector("#selected-file");
  const progressWrap = document.querySelector("#upload-progress");
  const progressBar = document.querySelector("#progress-bar");
  const progressValue = document.querySelector("#progress-value");
  const uploadButton = document.querySelector("#upload-button");
  const searchInput = document.querySelector("#file-search");
  const cards = [...document.querySelectorAll(".file-card")];
  const searchEmpty = document.querySelector("#search-empty");

  function showSelection() {
    selectedFile.textContent = fileInput.files.length
      ? `${fileInput.files[0].name} · ${formatBytes(fileInput.files[0].size)}`
      : "";
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** unit).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${units[unit]}`;
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone?.addEventListener("drop", (event) => {
    if (!event.dataTransfer.files.length) return;
    const transfer = new DataTransfer();
    transfer.items.add(event.dataTransfer.files[0]);
    fileInput.files = transfer.files;
    showSelection();
  });

  fileInput?.addEventListener("change", showSelection);

  uploadForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!fileInput.files.length) return;

    const request = new XMLHttpRequest();
    request.open("POST", uploadForm.action);
    request.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    progressWrap.hidden = false;
    uploadButton.disabled = true;

    request.upload.addEventListener("progress", (progressEvent) => {
      if (!progressEvent.lengthComputable) return;
      const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      progressBar.style.width = `${percent}%`;
      progressValue.textContent = `${percent}%`;
    });

    request.addEventListener("load", () => {
      let result = {};
      try {
        result = JSON.parse(request.responseText);
      } catch {
        result = {};
      }
      if (request.status >= 200 && request.status < 300) {
        window.location.assign("/dashboard");
      } else {
        showToast(result.message || "Dosya yüklenemedi.", "error");
        resetUpload();
      }
    });

    request.addEventListener("error", () => {
      showToast("Bağlantı hatası oluştu.", "error");
      resetUpload();
    });

    request.send(new FormData(uploadForm));
  });

  function resetUpload() {
    progressWrap.hidden = true;
    progressBar.style.width = "0%";
    progressValue.textContent = "0%";
    uploadButton.disabled = false;
  }

  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim().toLocaleLowerCase("tr-TR");
    let visible = 0;
    cards.forEach((card) => {
      const matches = card.dataset.filename.includes(query);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    if (searchEmpty) searchEmpty.hidden = visible !== 0;
  });

  document.querySelectorAll("[data-delete-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!window.confirm("Bu dosya kalıcı olarak silinsin mi?")) event.preventDefault();
    });
  });

  document.querySelectorAll("[data-toast]").forEach((toast) => {
    window.setTimeout(() => toast.classList.add("toast-hide"), 4000);
  });

  function showToast(message, type) {
    const region = document.querySelector("#toast-region");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.classList.add("toast-hide"), 4000);
  }
})();
