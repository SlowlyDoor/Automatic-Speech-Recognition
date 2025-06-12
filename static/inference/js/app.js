import { getCookie, saveBlob } from './utils.js';
import { MicRecorder } from './recorder.js';

/* ================== Константы ================== */
const ALLOWED_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.webm'];
const FILE_SUPPORT_TEXT = 'Поддержка: WAV, MP3, OGG, WEBM';
const FILE_ERROR_TEXT = 'Недопустимый формат файла. Разрешены только: WAV, MP3, OGG, WEBM.';
const PROCESSING_TEXT = 'Обработка';
const AUDIO_FILENAME_FOR_UPLOAD = 'rec.webm';

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
  langSel: document.getElementById('language'),
  fileError: document.getElementById('fileError'),
  fileSupport: document.getElementById('fileSupport'),
  recordedAudio: document.getElementById('recordedAudio')
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
  console.info('Распознавание завершено.');
}

function showWaiting() {
  let dots = '';
  elements.resultEl.textContent = PROCESSING_TEXT;
  elements.timeWrap.hidden = true;
  elements.dlButtons.hidden = true;

  waitingInterval = setInterval(() => {
    dots = (dots.length >= 3) ? '' : dots + '.';
    elements.resultEl.textContent = PROCESSING_TEXT + dots;
  }, 500);
  console.info('Ожидание результата...');
}

function setTab(mode) {
  activeMode = mode;
  elements.tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  elements.fileBlock.classList.toggle('d-none', mode !== 'file');
  elements.recBlock.classList.toggle('d-none', mode !== 'rec');
  updateRecognizeButtonState();
  console.info(`Переключено на режим: ${mode}`);
}

function updateRecognizeButtonState() {
  const isFileReady = (activeMode === 'file' && uploadedFile);
  const isRecReady = (activeMode === 'rec' && recordedBlob);

  const isEnabled = (isFileReady || isRecReady);

  // Доп. защита — ставим или убираем класс
  elements.recognizeBtn.classList.toggle('btn-disabled', !isEnabled);
}

/* ================== Файл: загрузка и проверка ================== */
elements.audioInput.addEventListener('change', e => {
  uploadedFile = e.target.files[0] || null;

  elements.fileError.style.display = 'none';
  elements.fileError.textContent = '';
  elements.fileSupport.style.display = 'block';
  elements.fileSupport.textContent = FILE_SUPPORT_TEXT;

  if (!uploadedFile) {
    resetFileInput();
    return;
  }

  const fileName = uploadedFile.name.toLowerCase();
  const isValid = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));

  if (!isValid) {
    resetFileInput();
    elements.fileSupport.style.display = 'none';
    elements.fileError.style.display = 'block';
    elements.fileError.textContent = FILE_ERROR_TEXT;
    return;
  }

  elements.fileSupport.style.display = 'block';
  elements.fileError.style.display = 'none';

  const url = URL.createObjectURL(uploadedFile);
  elements.filePlayer.src = url;
  elements.filePlayer.classList.remove('d-none');
  elements.filePlayer.onloadedmetadata = () => {
    elements.fileInfo.textContent = `${uploadedFile.name} · ${(uploadedFile.size / 1048576).toFixed(2)} МБ · ${elements.filePlayer.duration.toFixed(1)} сек`;
  };
  updateRecognizeButtonState();
});

function resetFileInput() {
  elements.audioInput.value = '';
  uploadedFile = null;
  elements.fileInfo.textContent = '';
  elements.filePlayer.classList.add('d-none');

  elements.fileError.style.display = 'none';
  elements.fileError.textContent = '';
  elements.fileSupport.style.display = 'block';
  elements.fileSupport.textContent = FILE_SUPPORT_TEXT;

  updateRecognizeButtonState();
}

/* ================== Запись ================== */
elements.micBtn.onclick = () => elements.micBtn.classList.contains('recording') ? stopRec() : startRec();

async function startRec() {
  setTab('rec');
  await recorder.start(blob => {
    recordedBlob = blob;
    elements.recordedAudio.src = URL.createObjectURL(blob);
    elements.recordedAudio.classList.remove('d-none');
    updateRecognizeButtonState();
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
  console.info('Запись начата');
}

function stopRec() {
  clearInterval(timer);
  elements.recInd.style.display = 'none';
  elements.micBtn.classList.remove('recording');
  elements.micBtn.innerHTML = '<i class="fa fa-microphone"></i>';
  recorder.stop();
  console.info('Запись остановлена');
  // Примечание: recordedBlob сохраняется → updateRecognizeButtonState не нужен тут, потому что оно уже есть
}

/* ================== Распознавание ================== */
elements.recognizeBtn.onclick = () => {
  const isFileReady = (activeMode === 'file' && uploadedFile);
  const isRecReady = (activeMode === 'rec' && recordedBlob);
  if (!(isFileReady || isRecReady)) {
    console.warn('Попытка отправить без готового файла или записи — заблокировано.');
    return;
  }

  const formData = new FormData();
  if (isFileReady) formData.append('audio_file', uploadedFile);
  else if (isRecReady) formData.append('audio_file', recordedBlob, AUDIO_FILENAME_FOR_UPLOAD);

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
