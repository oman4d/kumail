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

const state = {
  selectedSemester: "",
  selectedClass: "",
  selectedLessonId: null,
  students: [],
  lesson: null,
  usedStudents: [],
  usedQuestions: [],
  currentStudent: "",
  currentQuestion: null,
  isSpinning: false,
  wheelRotation: 0,
  audioContext: null
};

initialize();

function initialize() {
  fillClassSelect();
  fillLessonSelect();
  drawWheel(["اختر", "الشعبة", "والدرس"]);
  bindEvents();
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
  state.students = state.selectedClass ? [...(classesData[state.selectedClass] || [])] : [];
  state.lesson = state.selectedLessonId
    ? (lessonsData[state.selectedSemester] || []).find((lesson) => lesson.id === state.selectedLessonId) || null
    : null;

  state.usedStudents = [];
  state.usedQuestions = [];
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
  newQuestionBtn.disabled = !(state.currentStudent && state.lesson);
  nextStudentBtn.disabled = !(state.lesson && state.students.length) || state.isSpinning;
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

  const pool = getAvailableStudents();
  if (!pool.length) {
    state.usedStudents = [];
  }

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

function getAvailableQuestions() {
  let available = (state.lesson?.questions || []).filter(
    (question) => !state.usedQuestions.includes(question.id)
  );

  if (!available.length) {
    state.usedQuestions = [];
    available = [...(state.lesson?.questions || [])];
  }

  return available;
}

function animateWheel(chosenStudent) {
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

  const availableQuestions = getAvailableQuestions();
  const question = randomItem(availableQuestions);
  if (!question) return;

  state.currentQuestion = question;
  if (!state.usedQuestions.includes(question.id)) {
    state.usedQuestions.push(question.id);
  }

  emptyQuestionState.classList.add("hidden");
  questionBox.classList.remove("hidden");

  questionCounter.textContent = `السؤال ${question.id} من ${state.lesson.questions.length}`;
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

  refreshButtons();
}

function checkAnswer(selectedIndex, clickedButton) {
  if (!state.currentQuestion) return;

  ensureAudio();
  const buttons = [...optionsContainer.querySelectorAll(".option-btn")];
  const correctIndex = state.currentQuestion.correctIndex;
  const correctButton = buttons[correctIndex];

  if (selectedIndex === correctIndex) {
    clickedButton.classList.add("correct");
    buttons.forEach((btn) => (btn.disabled = true));
    setFeedback("أحسنت، إجابة صحيحة.", "success");
    playSuccessSound();
    newQuestionBtn.disabled = false;
    nextStudentBtn.disabled = false;
    return;
  }

  clickedButton.classList.add("wrong");
  clickedButton.disabled = true;
  setFeedback("فكّر جيدًا وحاول مرة أخرى.", "error");
  playFailSound();

  if (correctButton) {
    correctButton.classList.remove("correct");
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
  state.usedQuestions = [];
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
