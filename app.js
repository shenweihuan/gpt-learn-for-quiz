const storeKey = "examPilotMvpState";

const state = loadState();
let activeReviewCardId = null;

function loadState() {
  const fallback = {
    goal: {},
    tasks: [],
    material: "",
    keypoints: [],
    cards: [],
    quizzes: [],
    reviews: [],
    settings: {}
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(storeKey) || "{}") };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function escapeHTML(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initNavigation() {
  $all(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      $all(".nav-item").forEach(item => item.classList.remove("active"));
      $all(".view").forEach(view => view.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.view}`).classList.add("active");
    });
  });
}

function initGoalForm() {
  const goal = state.goal || {};
  $("#goalName").value = goal.name || "";
  $("#examDate").value = goal.date || "";
  $("#dailyMinutes").value = goal.minutes || 90;
  $("#subjects").value = (goal.subjects || []).join(", ");

  $("#goalForm").addEventListener("submit", event => {
    event.preventDefault();
    const subjects = $("#subjects").value.split(/[,，]/).map(item => item.trim()).filter(Boolean);
    state.goal = {
      name: $("#goalName").value.trim() || "短期考试复习",
      date: $("#examDate").value,
      minutes: Number($("#dailyMinutes").value || 90),
      subjects
    };
    state.tasks = generatePlan(state.goal);
    saveState();
    renderDashboard();
  });

  $("#resetToday").addEventListener("click", () => {
    state.tasks = state.tasks.map(task => ({ ...task, done: false }));
    saveState();
    renderDashboard();
  });
}

function generatePlan(goal) {
  const subjects = goal.subjects.length ? goal.subjects : ["四级单词", "四级阅读", "期末重点"];
  const minutes = Math.max(20, goal.minutes || 90);
  const block = Math.max(15, Math.floor(minutes / Math.min(subjects.length + 2, 5)));
  const tasks = [];

  tasks.push({
    id: uid("task"),
    title: "先测后学：做 3 道旧题或回忆 3 个知识点",
    subject: "启动",
    minutes: 10,
    done: false,
    reason: "先暴露问题，避免盲目看资料。"
  });

  subjects.slice(0, 4).forEach(subject => {
    tasks.push({
      id: uid("task"),
      title: `复习 ${subject}：整理 3 个考点并做 1 次主动回忆`,
      subject,
      minutes: block,
      done: false,
      reason: "把资料变成自己能说出来的答案。"
    });
  });

  tasks.push({
    id: uid("task"),
    title: "晚间复盘：写下完成内容、卡点和明天最小行动",
    subject: "复盘",
    minutes: 10,
    done: false,
    reason: "复盘决定明天先补什么。"
  });

  return tasks;
}

function renderDashboard() {
  const box = $("#todayPlan");
  const tasks = state.tasks || [];
  const done = tasks.filter(task => task.done).length;
  $("#progressText").textContent = `${done}/${tasks.length}`;

  if (!tasks.length) {
    box.className = "task-list empty";
    box.textContent = "还没有任务。先填写左侧目标。";
    return;
  }

  box.className = "task-list";
  box.innerHTML = tasks.map(task => `
    <label class="task-item ${task.done ? "done" : ""}">
      <input type="checkbox" data-task-id="${task.id}" ${task.done ? "checked" : ""} />
      <div>
        <strong>${escapeHTML(task.title)}</strong>
        <div class="task-meta">${escapeHTML(task.subject)} · ${task.minutes} 分钟 · ${escapeHTML(task.reason)}</div>
      </div>
    </label>
  `).join("");

  $all("[data-task-id]").forEach(input => {
    input.addEventListener("change", () => {
      const task = state.tasks.find(item => item.id === input.dataset.taskId);
      if (task) task.done = input.checked;
      saveState();
      renderDashboard();
    });
  });
}

function initMaterials() {
  $("#materialInput").value = state.material || "";

  $("#sampleMaterial").addEventListener("click", () => {
    $("#materialInput").value = "英语四级阅读常考定位、同义替换、长难句分析。作文需要积累开头句、过渡句和结尾句。计算机网络期末重点包括 OSI 七层模型、TCP/IP、IP 地址、子网划分、ARP、DNS、路由选择、VLAN、NAT、ACL。Python 期末重点包括文件读写、列表、字典、函数、异常处理。";
  });

  $("#generateKeypoints").addEventListener("click", () => generateFromMaterial("keypoints"));
  $("#generateCards").addEventListener("click", () => generateFromMaterial("cards"));
  $("#generateQuiz").addEventListener("click", () => generateFromMaterial("quiz"));

  $("#copyKeypoints").addEventListener("click", async () => {
    const text = state.keypoints.map((item, index) => `${index + 1}. ${item.title}\n${item.detail}`).join("\n\n");
    if (!text) return;
    await navigator.clipboard.writeText(text);
    alert("已复制考点。")
  });
}

async function generateFromMaterial(type) {
  const text = $("#materialInput").value.trim();
  if (!text) return alert("请先粘贴资料。")
  state.material = text;

  const localResult = localGenerate(text, type);
  applyGenerated(type, localResult);
  saveState();
  renderAll();

  const setting = state.settings || {};
  if (!setting.apiEndpoint || !setting.apiKey || !setting.apiModel) return;

  try {
    const aiResult = await callAI(text, type, setting);
    if (Array.isArray(aiResult) && aiResult.length) {
      applyGenerated(type, aiResult);
      saveState();
      renderAll();
    }
  } catch (error) {
    console.warn(error);
    alert("AI 接口调用失败，已保留本地规则生成结果。")
  }
}

async function callAI(text, type, setting) {
  const taskMap = {
    keypoints: "请从资料中提取 8 个考试高频考点，输出 JSON 数组，每项包含 title 和 detail。",
    cards: "请从资料中生成 10 张主动回忆卡片，输出 JSON 数组，每项包含 question 和 answer。",
    quiz: "请从资料中生成 6 道单选题，输出 JSON 数组，每项包含 question、options、answerIndex、explain。"
  };

  const response = await fetch(setting.apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${setting.apiKey}`
    },
    body: JSON.stringify({
      model: setting.apiModel,
      messages: [
        { role: "system", content: "你是考试导向的学习教练，只输出合法 JSON。" },
        { role: "user", content: `${taskMap[type]}\n\n资料：\n${text}` }
      ],
      temperature: 0.2
    })
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "[]";
  const cleaned = content.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

function localGenerate(text, type) {
  const keywords = extractKeywords(text);
  const sentences = text.split(/[。！？.!?\n]/).map(item => item.trim()).filter(Boolean);

  if (type === "keypoints") {
    return keywords.slice(0, 8).map((word, index) => ({
      title: word,
      detail: sentences[index % Math.max(sentences.length, 1)] || `围绕“${word}”整理定义、作用、例子和易错点。`
    }));
  }

  if (type === "cards") {
    return keywords.slice(0, 10).map((word, index) => ({
      question: `请用自己的话解释：${word}`,
      answer: sentences[index % Math.max(sentences.length, 1)] || `说明 ${word} 的定义、作用、适用场景和常见错误。`
    }));
  }

  return keywords.slice(0, 6).map((word, index) => {
    const options = shuffle([word, ...keywords.filter(k => k !== word).slice(0, 3)]).slice(0, 4);
    const answerIndex = Math.max(0, options.indexOf(word));
    return {
      question: "以下哪一项最可能是资料中的重点概念？",
      options,
      answerIndex,
      explain: sentences[index % Math.max(sentences.length, 1)] || `资料中多次出现 ${word}，应作为复习重点。`
    };
  });
}

function extractKeywords(text) {
  const chunks = [...text.matchAll(/[\u4e00-\u9fa5A-Za-z0-9]{2,16}/g)].map(match => match[0]);
  const stop = new Set(["这个", "一个", "我们", "可以", "需要", "进行", "资料", "复习", "学习", "包括", "例如"]);
  const count = new Map();

  chunks.forEach(item => {
    const word = item.trim();
    if (word.length < 2 || stop.has(word)) return;
    count.set(word, (count.get(word) || 0) + 1);
  });

  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
    .slice(0, 12);
}

function shuffle(array) {
  return array.map(value => [Math.random(), value]).sort((a, b) => a[0] - b[0]).map(item => item[1]);
}

function applyGenerated(type, result) {
  if (type === "keypoints") {
    state.keypoints = result.map(item => ({ title: item.title, detail: item.detail }));
  }
  if (type === "cards") {
    const cards = result.map(item => ({
      id: uid("card"),
      question: item.question,
      answer: item.answer,
      due: todayISO(),
      interval: 1,
      ease: 2.5,
      createdAt: new Date().toISOString()
    }));
    state.cards = [...cards, ...state.cards];
  }
  if (type === "quiz") {
    state.quizzes = result.map(item => ({
      id: uid("quiz"),
      question: item.question,
      options: item.options,
      answerIndex: item.answerIndex,
      explain: item.explain,
      answered: null
    }));
  }
}

function renderMaterials() {
  $("#materialInput").value = state.material || $("#materialInput").value;
  const box = $("#keypointsOutput");
  if (!state.keypoints.length) {
    box.className = "markdown-box empty";
    box.textContent = "还没有考点。";
    return;
  }
  box.className = "markdown-box";
  box.innerHTML = state.keypoints.map((item, index) => `
    <div class="keypoint-item">
      <strong>${index + 1}. ${escapeHTML(item.title)}</strong>
      <p>${escapeHTML(item.detail)}</p>
    </div>
  `).join("");
}

function initCards() {
  $("#addCard").addEventListener("click", () => {
    const question = $("#cardQuestion").value.trim();
    const answer = $("#cardAnswer").value.trim();
    if (!question || !answer) return alert("问题和答案都要填写。")
    state.cards.unshift({
      id: uid("card"),
      question,
      answer,
      due: todayISO(),
      interval: 1,
      ease: 2.5,
      createdAt: new Date().toISOString()
    });
    $("#cardQuestion").value = "";
    $("#cardAnswer").value = "";
    saveState();
    renderCards();
  });

  $("#clearCards").addEventListener("click", () => {
    if (confirm("确定清空全部卡片？")) {
      state.cards = [];
      activeReviewCardId = null;
      saveState();
      renderCards();
    }
  });

  $all("#reviewActions button").forEach(button => {
    button.addEventListener("click", () => rateCard(button.dataset.rating));
  });
}

function dueCards() {
  return state.cards.filter(card => card.due <= todayISO());
}

function renderCards() {
  const due = dueCards();
  $("#dueCount").textContent = `${due.length} 张`;

  if (!activeReviewCardId || !state.cards.find(card => card.id === activeReviewCardId)) {
    activeReviewCardId = due[0]?.id || null;
  }

  const active = state.cards.find(card => card.id === activeReviewCardId);
  const reviewBox = $("#reviewCard");
  const actions = $("#reviewActions");

  if (!active) {
    reviewBox.className = "review-card empty";
    reviewBox.textContent = "暂无到期卡片。可以从资料页生成。";
    actions.classList.add("hidden");
  } else {
    reviewBox.className = "review-card";
    reviewBox.innerHTML = `
      <div class="card-question">${escapeHTML(active.question)}</div>
      <p class="muted">先在脑子里回答，再点击卡片显示答案。</p>
      <div class="review-answer">${escapeHTML(active.answer)}</div>
    `;
    reviewBox.onclick = () => reviewBox.classList.add("revealed");
    actions.classList.remove("hidden");
  }

  const list = $("#cardList");
  if (!state.cards.length) {
    list.className = "card-list empty";
    list.textContent = "还没有卡片。";
    return;
  }
  list.className = "card-list";
  list.innerHTML = state.cards.map(card => `
    <div class="card-item">
      <strong>${escapeHTML(card.question)}</strong>
      <p>${escapeHTML(card.answer)}</p>
      <div class="task-meta">下次复习：${card.due} · 间隔：${card.interval} 天</div>
    </div>
  `).join("");
}

function rateCard(rating) {
  const card = state.cards.find(item => item.id === activeReviewCardId);
  if (!card) return;

  if (rating === "again") {
    card.interval = 1;
    card.ease = Math.max(1.3, card.ease - 0.25);
    card.due = todayISO();
  }
  if (rating === "hard") {
    card.interval = Math.max(1, Math.ceil(card.interval * 1.5));
    card.ease = Math.max(1.3, card.ease - 0.1);
    card.due = daysFromNow(card.interval);
  }
  if (rating === "good") {
    card.interval = Math.max(2, Math.ceil(card.interval * card.ease));
    card.ease = Math.min(3.0, card.ease + 0.05);
    card.due = daysFromNow(card.interval);
  }

  activeReviewCardId = dueCards().find(item => item.id !== card.id)?.id || null;
  saveState();
  renderCards();
}

function initQuiz() {
  $("#clearQuiz").addEventListener("click", () => {
    if (confirm("确定清空全部题目？")) {
      state.quizzes = [];
      saveState();
      renderQuiz();
    }
  });
}

function renderQuiz() {
  const box = $("#quizList");
  if (!state.quizzes.length) {
    box.className = "quiz-list empty";
    box.textContent = "暂无题目。请到资料页生成自测题。";
    return;
  }
  box.className = "quiz-list";
  box.innerHTML = state.quizzes.map((quiz, index) => `
    <div class="quiz-item">
      <strong>${index + 1}. ${escapeHTML(quiz.question)}</strong>
      <div class="quiz-options">
        ${quiz.options.map((option, optionIndex) => `
          <button class="option-btn ${quiz.answered === optionIndex ? (optionIndex === quiz.answerIndex ? "correct" : "wrong") : ""} ${quiz.answered !== null && optionIndex === quiz.answerIndex ? "correct" : ""}" data-quiz-id="${quiz.id}" data-option-index="${optionIndex}">
            ${String.fromCharCode(65 + optionIndex)}. ${escapeHTML(option)}
          </button>
        `).join("")}
      </div>
      ${quiz.answered !== null ? `<div class="explain">解析：${escapeHTML(quiz.explain)}</div>` : ""}
    </div>
  `).join("");

  $all("[data-quiz-id]").forEach(button => {
    button.addEventListener("click", () => {
      const quiz = state.quizzes.find(item => item.id === button.dataset.quizId);
      if (quiz) {
        quiz.answered = Number(button.dataset.optionIndex);
        saveState();
        renderQuiz();
      }
    });
  });
}

function initReview() {
  $("#reviewForm").addEventListener("submit", event => {
    event.preventDefault();
    const review = {
      id: uid("review"),
      date: todayISO(),
      done: $("#doneToday").value.trim(),
      stuck: $("#stuckToday").value.trim(),
      tomorrow: $("#tomorrowAction").value.trim(),
      createdAt: new Date().toISOString()
    };
    if (!review.done && !review.stuck && !review.tomorrow) return alert("至少写一项。")
    state.reviews.unshift(review);
    $("#doneToday").value = "";
    $("#stuckToday").value = "";
    $("#tomorrowAction").value = "";
    saveState();
    renderReview();
  });

  $("#exportData").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-pilot-data-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function renderReview() {
  const box = $("#reviewHistory");
  if (!state.reviews.length) {
    box.className = "history-list empty";
    box.textContent = "暂无复盘。";
    return;
  }
  box.className = "history-list";
  box.innerHTML = state.reviews.map(review => `
    <div class="history-item">
      <strong>${review.date}</strong>
      <p><b>完成：</b>${escapeHTML(review.done || "未填写")}</p>
      <p><b>卡点：</b>${escapeHTML(review.stuck || "未填写")}</p>
      <p><b>明天：</b>${escapeHTML(review.tomorrow || "未填写")}</p>
    </div>
  `).join("");
}

function initSettings() {
  $("#apiEndpoint").value = state.settings.apiEndpoint || "";
  $("#apiModel").value = state.settings.apiModel || "";
  $("#apiKey").value = state.settings.apiKey || "";

  $("#settingsForm").addEventListener("submit", event => {
    event.preventDefault();
    state.settings = {
      apiEndpoint: $("#apiEndpoint").value.trim(),
      apiModel: $("#apiModel").value.trim(),
      apiKey: $("#apiKey").value.trim()
    };
    saveState();
    alert("已保存设置。")
  });

  $("#clearSettings").addEventListener("click", () => {
    state.settings = {};
    $("#apiEndpoint").value = "";
    $("#apiModel").value = "";
    $("#apiKey").value = "";
    saveState();
  });
}

function renderAll() {
  renderDashboard();
  renderMaterials();
  renderCards();
  renderQuiz();
  renderReview();
}

initNavigation();
initGoalForm();
initMaterials();
initCards();
initQuiz();
initReview();
initSettings();
renderAll();
