const lessonsData = collectLessons(); // { "1": [...], "2": [...] }
const classesData = window.CLASSROOMS_DATA || {};

const semesterSelect = document.getElementById("semesterSelect");
const classSelect = document.getElementById("classSelect");
const lessonSelect = document.getElementById("lessonSelect");
const spinBtn = document.getElementById("spinBtn");
const newQuestionBtn = document.getElementById("newQuestionBtn");
const nextStudentBtn = document.getElementById("nextStudentBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const selectedStudentName = document.getElementById("selectedStudentName");
const wheelStatus = document.getElementById("wheelStatus");
const lessonBadge = document.getElementById("lessonBadge");
const questionBox = document.getElementById("questionBox");
const emptyQuestionState = document.getElementById("emptyQuestionState");
const questionCounter = document.getElementById("questionCounter");
const questionTypeBadge = document.getElementById("questionTypeBadge");
const questionText = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const feedbackBox = document.getElementById("feedbackBox");
const wheelCanvas = document.getElementById("wheelCanvas");
const ctx = wheelCanvas.getContext("2d");

// A 30-second circular timer is injected here so index.html and style.css stay unchanged.
const TIMER_SECONDS = 30;
const TIMER_RADIUS = 52;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;
let timerWrap;
let timerText;
let timerProgress;
// Track shown questions during the active browser-tab session, separately per semester and lesson.
const QUESTION_HISTORY_KEY = "grade9_chemistry_questions_history_v2";
const questionHistory = readQuestionHistory();

const state = {
  selectedSemester: "",
  selectedClass: "",
  selectedLessonId: null,
  students: [],
  lesson: null,
  usedStudents: [],
  currentStudent: "",
  currentQuestion: null,
  isSpinning: false,
  wheelRotation: 0,
  audioContext: null,
  wrongAttempts: 0,
  questionResolved: false,
  timerInterval: null,
  timerDeadline: 0
};

initialize();

function initialize() {
  fillClassSelect();
  fillLessonSelect();
  drawWheel(["اختر", "الشعبة", "والدرس"]);
  // The middle circle used to be a drawing. Place a real, accessible button above it.
  createWheelCenterButton();
  createQuestionTimer();
  // Never display the source question number or the question bank size.
  questionCounter.hidden = true;
  questionCounter.style.display = "none";
  bindEvents();
  refreshButtons();
}

function createWheelCenterButton() {
  const wheelCenterBtn = document.createElement("button");
  wheelCenterBtn.id = "wheelCenterBtn";
  wheelCenterBtn.type = "button";
  wheelCenterBtn.textContent = "ابدأ";
  wheelCenterBtn.setAttribute("aria-label", "اضغط لتدوير العجلة واختيار طالب");
  wheelCenterBtn.title = "تدوير العجلة";
  wheelCenterBtn.style.cssText = [
    "position:absolute", "top:50%", "left:50%", "transform:translate(-50%,-50%)",
    "height:88px", "width:88px", "border-radius:50%", "border:3px solid #fff",
    "background:#1768d1", "color:white", "font:bold 20px Tahoma,Arial,sans-serif",
    "box-shadow:0 3px 10px rgba(10,55,112,.25)", "z-index:4", "cursor:pointer"
  ].join(";");
  wheelCanvas.parentElement.appendChild(wheelCenterBtn);
  wheelCenterBtn.addEventListener("click", handleSpin);
}

function createQuestionTimer() {
  const tools = document.createElement("div");
  tools.className = "grade9-question-header-tools";
  lessonBadge.before(tools);
  tools.appendChild(lessonBadge);

  timerWrap = document.createElement("div");
  timerWrap.id = "timerWrap";
  timerWrap.className = "grade9-timer";
  timerWrap.setAttribute("role", "timer");
  timerWrap.setAttribute("aria-label", "الوقت المتبقي للإجابة");
  timerWrap.hidden = true;
  timerWrap.innerHTML = `
    <svg class="grade9-timer-svg" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="grade9-timer-track" cx="60" cy="60" r="52"></circle>
      <circle id="timerProgress" class="grade9-timer-progress" cx="60" cy="60" r="52"></circle>
    </svg>
    <span id="timerText" class="grade9-timer-text">30</span>
  `;
  tools.prepend(timerWrap);
  timerText = timerWrap.querySelector("#timerText");
  timerProgress = timerWrap.querySelector("#timerProgress");
  timerProgress.style.strokeDasharray = String(TIMER_CIRCUMFERENCE);
  timerProgress.style.strokeDashoffset = "0";

  const style = document.createElement("style");
  style.id = "grade9-question-timer-styles";
  style.textContent = `
    .grade9-question-header-tools { display:flex; align-items:center; gap:12px; min-width:0; }
    .grade9-timer[hidden] { display:none !important; }
    .grade9-timer { width:68px; height:68px; position:relative; flex:none; display:grid;
      place-items:center; font:bold 21px Tahoma,Arial,sans-serif; color:#1768d1; }
    .grade9-timer-svg { position:absolute; inset:0; width:100%; height:100%; transform:rotate(-90deg); }
    .grade9-timer-track { fill:none; stroke:#e0eaf5; stroke-width:9; }
    .grade9-timer-progress { fill:none; stroke:#1768d1; stroke-width:9; stroke-linecap:round;
      transition:stroke-dashoffset .12s linear; }
    .grade9-timer-text { position:relative; direction:ltr; font-variant-numeric:tabular-nums; }
    .grade9-timer.grade9-timer-warning { color:#c2410c; }
    .grade9-timer.grade9-timer-warning .grade9-timer-progress { stroke:#ea580c; }
    .option-btn.grade9-reveal-answer, .option-btn.grade9-reveal-answer:disabled {
      opacity:1; background:#dcfce7; border:3px solid #16a34a; color:#14532d;
      animation:grade9-correct-flash .8s ease-in-out infinite;
    }
    @keyframes grade9-correct-flash {
      0%,100% { background:#dcfce7; box-shadow:0 0 0 0 rgba(22,163,74,.2); }
      50% { background:#86efac; box-shadow:0 0 0 6px rgba(22,163,74,.25); }
    }
    @media (prefers-reduced-motion: reduce) {
      .option-btn.grade9-reveal-answer { animation:none; outline:3px solid #16a34a; }
    }
    @media (max-width:720px) {
      .grade9-question-header-tools { gap:7px; flex-wrap:wrap; justify-content:flex-start; }
      .grade9-timer { width:60px; height:60px; font-size:19px; }
    }
  `;
  document.head.appendChild(style);
}

function updateQuestionTimer(seconds) {
  timerText.textContent = String(seconds);
  timerProgress.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - seconds / TIMER_SECONDS));
  timerWrap.classList.toggle("grade9-timer-warning", seconds <= 10);
}

function stopQuestionTimer() {
  if (state.timerInterval !== null) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function hideQuestionTimer() {
  stopQuestionTimer();
  if (timerWrap) {
    timerWrap.hidden = true;
    timerWrap.classList.remove("grade9-timer-warning");
    updateQuestionTimer(TIMER_SECONDS);
  }
}

function startQuestionTimer() {
  stopQuestionTimer();
  updateQuestionTimer(TIMER_SECONDS);
  timerWrap.hidden = false;
  state.timerDeadline = performance.now() + TIMER_SECONDS * 1000;
  state.timerInterval = window.setInterval(() => {
    // Use elapsed time rather than counting interval ticks, even if the tab was suspended.
    const remaining = Math.max(0, Math.ceil((state.timerDeadline - performance.now()) / 1000));
    updateQuestionTimer(remaining);
    if (remaining === 0) {
      stopQuestionTimer();
      if (!state.questionResolved && !state.isSpinning) {
        revealCorrectAnswer("انتهى الوقت. الإجابة الصحيحة تومض أمامك.");
        ensureAudio();
        playFailSound();
      }
    }
  }, 100);
}

function revealCorrectAnswer(message) {
  if (!state.currentQuestion || state.questionResolved) return;
  state.questionResolved = true;
  stopQuestionTimer();
  const buttons = [...optionsContainer.querySelectorAll(".option-btn")];
  buttons.forEach((btn) => (btn.disabled = true));
  const correctButton = buttons[state.currentQuestion.correctIndex];
  if (correctButton) {
    correctButton.classList.add("correct", "grade9-reveal-answer");
  }
  setFeedback(message, "error");
  newQuestionBtn.disabled = false;
  nextStudentBtn.disabled = false;
}

function bindEvents() {
  semesterSelect.addEventListener("change", () => {
    fillLessonSelect();
    onSelectionChange();
  });
  classSelect.addEventListener("change", onSelectionChange);
  lessonSelect.addEventListener("change", onSelectionChange);

  spinBtn.addEventListener("click", handleSpin);
  newQuestionBtn.addEventListener("click", showRandomQuestion);
  nextStudentBtn.addEventListener("click", handleSpin);
  resetAllBtn.addEventListener("click", resetAll);
}

function onSelectionChange() {
  state.selectedSemester = semesterSelect.value;
  state.selectedClass = classSelect.value;
  state.selectedLessonId = Number(lessonSelect.value) || null;
  // Shuffle a COPY: never change students.js and never show names alphabetically.
  state.students = state.selectedClass ? shuffleArray([...(classesData[state.selectedClass] || [])]) : [];
  state.lesson = state.selectedLessonId
    ? (lessonsData[state.selectedSemester] || []).find((lesson) => lesson.id === state.selectedLessonId) || null
    : null;

  state.usedStudents = [];
  // Do NOT clear question history when changing class, semester, or lesson.
  state.currentStudent = "";
  state.currentQuestion = null;

  selectedStudentName.textContent = "—";
  lessonBadge.textContent = state.lesson ? state.lesson.title : "لم يتم اختيار درس بعد";
  resetQuestionArea();
  refreshButtons();

  if (state.students.length) {
    drawWheel(state.students);
  } else {
    drawWheel(["اختر", "الشعبة", "والدرس"]);
  }
}

function fillClassSelect() {
  Object.keys(classesData).forEach((className) => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    classSelect.appendChild(option);
  });
}

function fillLessonSelect() {
  lessonSelect.replaceChildren();
  const semester = semesterSelect.value;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = semester ? "اختر الدرس" : "اختر الفصل الدراسي أولاً";
  lessonSelect.appendChild(placeholder);
  lessonSelect.disabled = !semester;

  (lessonsData[semester] || []).forEach((lesson) => {
    const option = document.createElement("option");
    option.value = lesson.id;
    option.textContent = `${lesson.id} - ${lesson.title}`;
    lessonSelect.appendChild(option);
  });
}

function refreshButtons() {
  const ready = Boolean(state.selectedSemester && state.selectedClass && state.lesson && state.students.length);
  spinBtn.disabled = !ready || state.isSpinning;
  const wheelCenterBtn = document.getElementById("wheelCenterBtn");
  if (wheelCenterBtn) wheelCenterBtn.disabled = !ready || state.isSpinning;
  newQuestionBtn.disabled = !(state.currentStudent && state.lesson) || state.isSpinning;
  nextStudentBtn.disabled = !ready || state.isSpinning;
}

function handleSpin() {
  if (!state.selectedSemester || !state.selectedClass || !state.lesson) {
    setFeedback("اختر الفصل الدراسي والشعبة والدرس أولاً.", "error");
    return;
  }

  if (!state.students.length) {
    setFeedback("لا توجد أسماء طلاب في هذه الشعبة.", "error");
    return;
  }

  if (state.isSpinning) return;

  // A fresh random wheel layout for every spin, including its starting position.
  shuffleArray(state.students);
  drawWheel(state.students, state.wheelRotation);
  const availableStudents = getAvailableStudents();
  const chosenStudent = randomItem(availableStudents);
  if (!chosenStudent) return;

  animateWheel(chosenStudent);
}

function getAvailableStudents() {
  let available = state.students.filter((name) => !state.usedStudents.includes(name));
  if (!available.length) {
    state.usedStudents = [];
    available = [...state.students];
  }
  return available;
}

// Identify questions by their wording, not their numeric IDs (which may repeat in source files).
function questionKey(question) {
  return String(question?.text || "").replace(/\s+/g, " ").trim();
}

function lessonHistoryKey() {
  return `${state.selectedSemester}:${state.selectedLessonId}`;
}

function getAvailableQuestions() {
  if (!state.lesson) return [];
  const lessonKey = lessonHistoryKey();
  // Ignore identical question texts within a lesson to prevent accidental repeats.
  const distinctQuestions = [];
  const seenInBank = new Set();
  for (const question of state.lesson.questions || []) {
    const key = questionKey(question);
    if (!key || seenInBank.has(key)) continue;
    seenInBank.add(key);
    distinctQuestions.push(question);
  }

  const used = new Set(questionHistory[lessonKey] || []);
  const available = distinctQuestions.filter((q) => !used.has(questionKey(q)));
  if (available.length) return available;

  // Every distinct question was shown: start a new cycle, avoiding an instant
  // repeat of the last shown question when possible.
  const previous = (questionHistory[lessonKey] || []).at(-1);
  questionHistory[lessonKey] = [];
  saveQuestionHistory();
  if (distinctQuestions.length > 1 && previous) {
    return distinctQuestions.filter((q) => questionKey(q) !== previous);
  }
  return distinctQuestions;
}

function readQuestionHistory() {
  try {
    const history = JSON.parse(sessionStorage.getItem(QUESTION_HISTORY_KEY) || "{}");
    return history && typeof history === "object" && !Array.isArray(history) ? history : {};
  } catch (_) {
    return {};
  }
}

function saveQuestionHistory() {
  try {
    sessionStorage.setItem(QUESTION_HISTORY_KEY, JSON.stringify(questionHistory));
  } catch (_) {
    // In private browsing contexts without storage, in-memory tracking still works.
  }
}

function animateWheel(chosenStudent) {
  hideQuestionTimer();
  state.isSpinning = true;
  refreshButtons();
  wheelStatus.textContent = "جاري الدوران...";

  const students = state.students;
  const selectedIndex = students.indexOf(chosenStudent);
  const segmentAngle = (Math.PI * 2) / students.length;
  // Align the selected segment with the top red pointer, not the left side.
  const targetAngle = -((selectedIndex + 0.5) * segmentAngle);

  const currentNormalized = ((state.wheelRotation % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
  let delta = targetAngle - currentNormalized;
  while (delta < 0) delta += Math.PI * 2;

  const extraSpins = Math.PI * 2 * (5 + Math.floor(Math.random() * 3));
  const startRotation = state.wheelRotation;
  const endRotation = startRotation + delta + extraSpins;
  const duration = 4200;
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    state.wheelRotation = startRotation + ((endRotation - startRotation) * eased);
    drawWheel(students, state.wheelRotation);

    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }

    state.isSpinning = false;
    state.currentStudent = chosenStudent;
    state.usedStudents.push(chosenStudent);
    selectedStudentName.textContent = chosenStudent;
    wheelStatus.textContent = "تم اختيار الطالب";
    showRandomQuestion();
    refreshButtons();
  };

  requestAnimationFrame(step);
}

function showRandomQuestion() {
  if (!state.lesson) return;
  stopQuestionTimer();
  state.wrongAttempts = 0;
  state.questionResolved = false;

  const availableQuestions = getAvailableQuestions();
  const question = randomItem(availableQuestions);
  if (!question) return;

  state.currentQuestion = question;
  const lessonKey = lessonHistoryKey();
  if (!Array.isArray(questionHistory[lessonKey])) questionHistory[lessonKey] = [];
  const key = questionKey(question);
  if (!questionHistory[lessonKey].includes(key)) {
    questionHistory[lessonKey].push(key);
    saveQuestionHistory();
  }

  emptyQuestionState.classList.add("hidden");
  questionBox.classList.remove("hidden");

  questionTypeBadge.textContent =
    question.type === "true_false" ? "صح أو خطأ" : "اختيار من متعدد";
  questionText.textContent = question.text;

  optionsContainer.innerHTML = "";
  feedbackBox.className = "feedback-box";
  feedbackBox.textContent = "اختر الإجابة الصحيحة.";

  question.options.forEach((optionText, index) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.type = "button";
    btn.textContent = `${index + 1}) ${optionText}`;
    btn.addEventListener("click", () => checkAnswer(index, btn));
    optionsContainer.appendChild(btn);
  });

  startQuestionTimer();
  refreshButtons();
}

function checkAnswer(selectedIndex, clickedButton) {
  if (!state.currentQuestion || state.questionResolved || state.isSpinning || clickedButton.disabled) return;

  ensureAudio();
  const buttons = [...optionsContainer.querySelectorAll(".option-btn")];
  const correctIndex = state.currentQuestion.correctIndex;

  if (selectedIndex === correctIndex) {
    state.questionResolved = true;
    stopQuestionTimer();
    clickedButton.classList.add("correct");
    buttons.forEach((btn) => (btn.disabled = true));
    setFeedback("أحسنت، إجابة صحيحة.", "success");
    playSuccessSound();
    newQuestionBtn.disabled = false;
    nextStudentBtn.disabled = false;
    return;
  }

  state.wrongAttempts += 1;
  clickedButton.classList.add("wrong");
  clickedButton.disabled = true;
  playFailSound();

  if (state.wrongAttempts === 1) {
    setFeedback("إجابة غير صحيحة. لديك محاولة ثانية.", "error");
  } else {
    revealCorrectAnswer("انتهت المحاولتان. الإجابة الصحيحة تومض أمامك.");
  }
}

function setFeedback(message, mode = "") {
  feedbackBox.className = "feedback-box";
  if (mode) {
    feedbackBox.classList.add(mode);
  }
  feedbackBox.textContent = message;
}

function resetQuestionArea() {
  hideQuestionTimer();
  state.wrongAttempts = 0;
  state.questionResolved = false;
  questionBox.classList.add("hidden");
  emptyQuestionState.classList.remove("hidden");
  questionText.textContent = "";
  optionsContainer.innerHTML = "";
  feedbackBox.className = "feedback-box";
  feedbackBox.textContent = "اختر الإجابة الصحيحة.";
  wheelStatus.textContent = "جاهز";
  refreshButtons();
}

function resetAll() {
  state.selectedSemester = "";
  state.selectedClass = "";
  state.selectedLessonId = null;
  state.students = [];
  state.lesson = null;
  state.usedStudents = [];
  // "إعادة ضبط كاملة" clears all session question history too.
  for (const key of Object.keys(questionHistory)) delete questionHistory[key];
  saveQuestionHistory();
  state.currentStudent = "";
  state.currentQuestion = null;
  state.isSpinning = false;
  state.wheelRotation = 0;

  semesterSelect.value = "";
  classSelect.value = "";
  fillLessonSelect();
  selectedStudentName.textContent = "—";
  lessonBadge.textContent = "لم يتم اختيار درس بعد";
  drawWheel(["اختر", "الشعبة", "والدرس"]);
  resetQuestionArea();
}

function collectLessons() {
  // Use either separate S1 lesson files or a single questions-semester1.js bundle.
  const semester1 = Array.isArray(window.S1_LESSONS)
    ? window.S1_LESSONS
    : Array.from({ length: 19 }, (_, i) => window[`S1_LESSON_${String(i + 1).padStart(2, "0")}`]);
  const semester2 = Array.from({ length: 15 }, (_, i) => window[`LESSON_${String(i + 1).padStart(2, "0")}`]);
  return {
    "1": semester1.filter(Boolean).sort((a, b) => a.id - b.id),
    "2": semester2.filter(Boolean).sort((a, b) => a.id - b.id)
  };
}

function drawWheel(labels, rotation = 0) {
  const size = wheelCanvas.width;
  const radius = size / 2;
  const segments = Math.max(labels.length, 1);
  const angle = (Math.PI * 2) / segments;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(rotation);

  for (let i = 0; i < segments; i++) {
    const start = (i * angle) - (Math.PI / 2);
    const end = start + angle;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius - 12, start, end);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#dbeafe" : "#bfdbfe";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + angle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = labels.length > 18 ? "bold 16px Tahoma" : "bold 18px Tahoma";
    const shortened = shortenText(labels[i], labels.length > 18 ? 18 : 22);
    ctx.fillText(shortened, radius - 28, 6);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.fillStyle = "#1768d1";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Tahoma";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ابدأ", 0, 1);

  ctx.restore();
}

function shortenText(text, maxLength) {
  const normalized = String(text || "").trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength - 1) + "…";
}

function randomItem(array) {
  if (!array.length) return null;
  return array[Math.floor(Math.random() * array.length)];
}

// In-place Fisher-Yates shuffle. Each arrangement is independent of Arabic name order.
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function ensureAudio() {
  if (state.audioContext) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  state.audioContext = new AudioCtx();
}

function playSuccessSound() {
  if (!state.audioContext) return;
  playTone(660, 0.12, 0, "triangle");
  playTone(880, 0.14, 0.12, "triangle");
  playTone(1040, 0.18, 0.26, "triangle");
}

function playFailSound() {
  if (!state.audioContext) return;
  playTone(260, 0.18, 0, "sawtooth");
  playTone(220, 0.22, 0.16, "sawtooth");
}

function playTone(frequency, duration, delay = 0, type = "sine") {
  const now = state.audioContext.currentTime + delay;
  const oscillator = state.audioContext.createOscillator();
  const gainNode = state.audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(state.audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}
