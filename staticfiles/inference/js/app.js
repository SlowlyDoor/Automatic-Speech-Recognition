// main.js (вместо app.js — теперь модулярно)

import { getCookie, saveBlob } from './utils.js';
import { MicRecorder } from './recorder.js';

/* ================== DOM ссылки ================== */
const elements = {
  tabs: document.querySelectorAll('#modeTabs .nav-link'),
  fileBlock: document.getElementById('fileBlock'),
  recBlock: document.getElementById('recBlock'),
  audioInput: document.getElementById('audio_file'),
  filePlayer: document.getElementById('filePlayer'),
  fileInfo: document.getElementById('fileInfo'),
  micBtn: document.getElementById('micBtn'),
  recInd: document.getElementById('recIndicator'),
  recTime: document.getElementById('recTime'),
  recognizeBtn: document.getElementById('recognizeBtn'),
  resultEl: document.getElementById('result'),
  timeWrap: document.getElementById('processingTime'),
  timeVal: document.getElementById('timeValue'),
  dlButtons: document.getElementById('dlButtons'),
  saveTxtBtn: document.getElementById('saveTxt'),
  savePdfBtn: document.getElementById('savePDF'),
  modelSel: document.getElementById('model'),
  langSel: document.getElementById('language')
};

/* ================== Состояние ================== */
let activeMode = 'file';
let uploadedFile = null;
let recordedBlob = null;
let timer = 0, sec = 0;
const recorder = new MicRecorder();
let waitingInterval = null;

/* ================== UI ================== */
function showResult(text, secs) {
  clearInterval(waitingInterval);
  waitingInterval = null;

  elements.resultEl.textContent = text;
  if (secs) {
    elements.timeVal.textContent = secs;
    elements.timeWrap.hidden = false;
  }
  elements.dlButtons.hidden = false;
  console.info('✅ Распознавание завершено.');
}

function showWaiting() {
  let dots = '';
  elements.resultEl.textContent = 'Обработка';
  elements.timeWrap.hidden = true;
  elements.dlButtons.hidden = true;

  waitingInterval = setInterval(() => {
    dots = (dots.length >= 3) ? '' : dots + '.';
    elements.resultEl.textContent = 'Обработка' + dots;
  }, 500);
  console.info('⏳ Ожидание результата...');
}

function setTab(mode) {
  activeMode = mode;
  elements.tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  elements.fileBlock.classList.toggle('d-none', mode !== 'file');
  elements.recBlock.classList.toggle('d-none', mode !== 'rec');
  console.info(`🔁 Переключено на режим: ${mode}`);
}

/* ================== Файл: загрузка и проверка ================== */
elements.audioInput.addEventListener('change', e => {
  uploadedFile = e.target.files[0] || null;
  if (!uploadedFile) {
    resetFileInput();
    return;
  }

  const allowedExtensions = ['.wav', '.mp3', '.ogg'];
  const fileName = uploadedFile.name.toLowerCase();
  const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));

  if (!isValid) {
    alert('❌ Недопустимый формат файла. Разрешены только: WAV, MP3, OGG.');
    resetFileInput();
    return;
  }

  const url = URL.createObjectURL(uploadedFile);
  elements.filePlayer.src = url;
  elements.filePlayer.classList.remove('d-none');
  elements.filePlayer.onloadedmetadata = () => {
    elements.fileInfo.textContent = `${uploadedFile.name} · ${(uploadedFile.size / 1048576).toFixed(2)} МБ · ${elements.filePlayer.duration.toFixed(1)} сек`;
  };
});

function resetFileInput() {
  elements.audioInput.value = '';
  uploadedFile = null;
  elements.fileInfo.textContent = '';
  elements.filePlayer.classList.add('d-none');
}

/* ================== Запись ================== */
elements.micBtn.onclick = () => elements.micBtn.classList.contains('recording') ? stopRec() : startRec();

async function startRec() {
  setTab('rec');
  await recorder.start(blob => {
    recordedBlob = blob;
    const pl = document.getElementById('recordedAudio');
    pl.src = URL.createObjectURL(blob);
    pl.classList.remove('d-none');
  });
  sec = 0;
  elements.recTime.textContent = '00:00';
  elements.recInd.style.display = 'flex';
  elements.micBtn.classList.add('recording');
  elements.micBtn.innerHTML = '<i class="fa fa-stop"></i>';
  timer = setInterval(() => {
    sec++;
    elements.recTime.textContent = `${String(sec / 60 | 0).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }, 1000);
  console.info('🔴 Запись начата');
}

function stopRec() {
  clearInterval(timer);
  elements.recInd.style.display = 'none';
  elements.micBtn.classList.remove('recording');
  elements.micBtn.innerHTML = '<i class="fa fa-microphone"></i>';
  recorder.stop();
  console.info('⏹️ Запись остановлена');
}

/* ================== Распознавание ================== */
elements.recognizeBtn.onclick = () => {
  const formData = new FormData();
  if (activeMode === 'file' && uploadedFile) formData.append('audio_file', uploadedFile);
  else if (activeMode === 'rec' && recordedBlob) formData.append('audio_file', recordedBlob, 'rec.webm');
  else return alert('Добавьте файл или запишите речь.');

  formData.append('model', elements.modelSel.value);
  formData.append('language', elements.langSel.value);

  showWaiting();
  fetch('/api/transcribe/', {
    method: 'POST',
    body: formData,
    headers: { 'X-CSRFToken': getCookie('csrftoken') },
    credentials: 'same-origin'
  })
    .then(r => r.json())
    .then(d => showResult(d.text || 'Пустой результат', d.processing_time))
    .catch(e => showResult('Ошибка:\n' + e));
};

/* ================== Скачивание ================== */
elements.saveTxtBtn.onclick = () => saveBlob(new Blob([elements.resultEl.textContent], { type: 'text/plain' }), 'transcription.txt');
elements.savePdfBtn.onclick = () => pdfMake.createPdf({ content: elements.resultEl.textContent.split('\n') })
  .download('transcription.pdf');

/* ================== Инициализация ================== */
elements.tabs.forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.mode)));
setTab('file');
