// extra.js - Extend ExamPilot with file upload and wrong question book functionality

// Immediately-invoked function expression to avoid polluting global scope
(function() {
  // Ensure the global state has a `wrongs` array
  if (!state.wrongs) {
    state.wrongs = [];
  }

  /**
   * Persist the current state (including wrongs) to localStorage.
   */
  function saveWrongs() {
    // Reuse saveState from app.js
    saveState();
  }

  /**
   * Render the wrong question list into the #wrongList element.
   */
  function renderWrongs() {
    const list = document.getElementById("wrongList");
    if (!list) return;
    const wrongs = state.wrongs || [];
    if (!wrongs.length) {
      list.className = "card-list empty";
      list.textContent = "还没有错题。";
      return;
    }
    list.className = "card-list";
    list.innerHTML = wrongs
      .map((item, index) => {
        const analysisHtml = item.analysis
          ? `<p><em>解析：${escapeHTML(item.analysis)}</em></p>`
          : "";
        const tagHtml = item.tag
          ? `<p class=\"muted\">标签：${escapeHTML(item.tag)}</p>`
          : "";
        return `
          <div class=\"history-item\">
            <strong>${index + 1}. ${escapeHTML(item.question)}</strong>
            <p>${escapeHTML(item.answer)}</p>
            ${analysisHtml}
            ${tagHtml}
          </div>
        `;
      })
      .join("");
  }

  /**
   * Initialize the wrong question book features: attach event listeners and load existing wrongs.
   */
  function initWrongs() {
    const addBtn = document.getElementById("addWrong");
    const clearBtn = document.getElementById("clearWrongs");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const qEl = document.getElementById("wrongQuestion");
        const aEl = document.getElementById("wrongAnswer");
        const anEl = document.getElementById("wrongAnalysis");
        const tagEl = document.getElementById("wrongTag");
        const question = (qEl.value || "").trim();
        const answer = (aEl.value || "").trim();
        const analysis = (anEl.value || "").trim();
        const tag = (tagEl.value || "").trim();
        if (!question || !answer) {
          alert("请填写题目和正确答案。");
          return;
        }
        state.wrongs.unshift({
          id: uid("wrong"),
          question,
          answer,
          analysis,
          tag,
          createdAt: new Date().toISOString()
        });
        // Clear input fields after adding
        qEl.value = "";
        aEl.value = "";
        anEl.value = "";
        tagEl.value = "";
        saveWrongs();
        renderWrongs();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (!confirm("确定要清空错题本吗？")) return;
        state.wrongs = [];
        saveWrongs();
        renderWrongs();
      });
    }
    // Render existing wrongs on initialization
    renderWrongs();
  }

  /**
   * Initialize file upload for materials: when the user clicks the load button,
   * read the selected file and fill #materialInput with its contents.
   */
  function initFileUpload() {
    const loadBtn = document.getElementById("loadFile");
    const fileInput = document.getElementById("materialFile");
    if (!loadBtn || !fileInput) return;
    loadBtn.addEventListener("click", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        alert("请先选择文件。");
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e) {
        const text = e.target.result || "";
        const inputEl = document.getElementById("materialInput");
        inputEl.value = text;
        // Persist material into state
        state.material = text;
        saveState();
      };
      reader.readAsText(file, "utf-8");
    });
  }

  // Monkey-patch renderAll to also render wrong question book whenever state changes
  const originalRenderAll = window.renderAll;
  window.renderAll = function() {
    originalRenderAll();
    renderWrongs();
  };

  // Initialize custom features on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    initFileUpload();
    initWrongs();
  });
})();
