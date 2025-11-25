// ...existing code...
let allData = [];
let data = [];
let index = 0;
let correct = 0;
let wrong = 0;
let locked = false;
let total = 0;

const quiz = document.getElementById("quiz");
const home = document.getElementById("home");
const scoreBox = document.getElementById("score");
const statusBox = document.getElementById("status");

// small helpers
function formatChoice(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    // limit to 6 decimals, remove trailing zeros
    if (Number.isInteger(v)) return String(v);
    return String(Number(v.toFixed(6))).replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
  }
  if (typeof v === "string") {
    const t = v.trim();
    // normalize Excel time strings like "1:55:00 AM" -> "1:55 AM" or "07:30" -> "07:30"
    const timeMatch = t.match(/^(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/);
    if (timeMatch) {
      return timeMatch[1] + (timeMatch[2] ? " " + timeMatch[2].toUpperCase() : "");
    }
    return t;
  }
  return String(v);
}
function toAnswerIndex(val) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n) - 1) : 0;
}
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Load questions from Excel (requires XLSX lib)
fetch("qs.xlsx")
  .then(r => r.arrayBuffer())
  .then(buf => {
    const wb = XLSX.read(buf, { type: "array" });
    const sh = wb.Sheets[wb.SheetNames[0]];
    // raw:false tells sheet_to_json to use the cell's formatted text (so times/dates keep their display strings)
    const rows = XLSX.utils.sheet_to_json(sh, { raw: false });

    allData = rows.map(r => ({
      topic: r.Topic,
      question: r.Question_Text,
      choices: [r.choice_1, r.choice_2, r.choice_3, r.choice_4].map(formatChoice),
      answer: toAnswerIndex(r.answer_key),
      solution: r.Solution
    }));

    loadHome();
  })
  .catch(err => {
    console.error("Failed to load workbook:", err);
    if (quiz) quiz.innerHTML = "<p>Failed to load questions file.</p>";
  });

function loadHome() {
  if (!quiz) return;
  quiz.innerHTML = "";
  if (scoreBox) scoreBox.style.display = "none";
  if (statusBox) statusBox.style.display = "none";

  const topics = [...new Set(allData.map(q => q.topic))].filter(Boolean);

  if (!home) return;
  home.innerHTML = `
    <h2>Select Topic</h2>
    <select id='topicSel'>
      ${topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}
    </select>

    <h2>Number of Questions</h2>
    <input type='number' id='countSel' min='1' placeholder='Leave empty for all' />

    <button class='home-btn' id='startBtn'>Start Quiz</button>
  `;

  const startBtn = document.getElementById("startBtn");
  if (startBtn) startBtn.addEventListener("click", startQuiz);
}

function startQuiz() {
  const topicEl = document.getElementById("topicSel");
  const countEl = document.getElementById("countSel");
  const topic = topicEl ? topicEl.value : "";
  let count = parseInt(countEl && countEl.value ? countEl.value : "", 10);

  const filtered = allData.filter(q => q.topic === topic);

  if (!filtered.length) {
    quiz.innerHTML = "<p>No questions available for the selected topic.</p>";
    return;
  }

  if (!Number.isFinite(count) || count <= 0) count = filtered.length;
  if (count > filtered.length) count = filtered.length;

  data = filtered.slice(0, count);
  total = count;
  index = 0;
  correct = 0;
  wrong = 0;

  if (home) home.innerHTML = "";
  if (scoreBox) scoreBox.style.display = "block";
  if (statusBox) statusBox.style.display = "block";

  // allow absolute positioning for top-right Exit button
  if (quiz) quiz.style.position = "relative";

  updateScore();
  updateStatus();
  showQuestion();
}

function exitQuiz() {
  if (!quiz) return;
  quiz.innerHTML = `
    <h2 style="margin-top:0">Quiz Exited</h2>
    <button class='home-btn' id='returnHome'>Return Home</button>
  `;
  if (scoreBox) scoreBox.style.display = "none";
  if (statusBox) statusBox.style.display = "none";

  const ret = document.getElementById("returnHome");
  if (ret) ret.addEventListener("click", loadHome);
}

function updateScore() {
  if (scoreBox) scoreBox.innerText = `Correct: ${correct} | Wrong: ${wrong}`;
}

function updateStatus() {
  if (statusBox) statusBox.innerText = (index < total) ? `Question ${index + 1} of ${total}` : `Question ${total} of ${total}`;
}

function showQuestion() {
  if (!quiz) return;

  if (index >= data.length) {
    quiz.innerHTML = `
      <h2>Test Completed</h2>
      <p>Correct: ${correct} | Wrong: ${wrong}</p>
      <button class='home-btn' id='returnHomeFinished'>Return Home</button>
    `;
    const ret = document.getElementById("returnHomeFinished");
    if (ret) ret.addEventListener("click", loadHome);
    return;
  }

  locked = false;
  const q = data[index] || { question: "", choices: [], answer: 0, solution: "" };

  // top-right red Exit button always present
  quiz.innerHTML = `
    

    <div id='cont'>
      <h3>${escapeHtml(q.question)}</h3>
      <div id="choices">
        ${q.choices.map((c, i) => `<button class="choice-btn" data-index="${i}" style="display:block;font-size:20px;margin:20px 0;padding:18px 12px">${escapeHtml(c)}</button>`).join("")}
      </div>

      <div id='ans' ></div>
    </div>
  `;

  const exitTop = document.getElementById("exitBtnTop");
  if (exitTop) exitTop.addEventListener("click", exitQuiz);

  const choiceBtns = quiz.querySelectorAll(".choice-btn");
  choiceBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-index"), 10);
      choose(i);
    });
  });
}

function choose(i) {
  if (locked) return;
  locked = true;

  const q = data[index];
  const choiceBtns = quiz.querySelectorAll(".choice-btn");
  if (!q || choiceBtns.length === 0) return;

  if (typeof i !== "number" || i < 0 || i >= choiceBtns.length) return;

  if (i === q.answer) {
    choiceBtns[i].classList.add("correct");
    choiceBtns[i].style.background = "#2ecc71";
    correct++;
  } else {
    choiceBtns[i].classList.add("wrong");
    choiceBtns[i].style.background = "#e74c3c";
    if (q.answer >= 0 && q.answer < choiceBtns.length) {
      choiceBtns[q.answer].classList.add("correct");
      choiceBtns[q.answer].style.background = "#2ecc71";
    }
    wrong++;
  }

  updateScore();

  const solutionHtml = q.solution ? `<br><br>${escapeHtml(q.solution)}` : "";
  const ansEl = document.getElementById("ans");
  if (ansEl) {
    ansEl.innerHTML = `
      <div class='answer-box' style="margin-bottom:0px">Correct Answer: ${escapeHtml(q.choices[q.answer] ?? "")}${solutionHtml}</div>
      <button id='nextBtn' style="padding:20px 10px">Next</button>
    `;
    const nextBtn = document.getElementById("nextBtn");
    if (nextBtn) nextBtn.addEventListener("click", next);
  }
}

function next() {
  index++;
  updateStatus();
  showQuestion();
}