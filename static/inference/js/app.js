import { getCookie, saveBlob } from './utils.js';
import { MicRecorder } from './recorder.js';

/* ================== Константы ================== */
const ALLOWED_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.webm', '.weba'];
const FILE_SUPPORT_TEXT = 'Поддержка: WAV, MP3, OGG, WEBM (WEBA)';
const FILE_ERROR_TEXT = 'Недопустимый формат файла. Разрешены только: WAV, MP3, OGG, WEBM (WEBA).';
const PROCESSING_TEXT = 'Обработка';
const AUDIO_FILENAME_FOR_UPLOAD = 'rec.webm';
const AUDIOFILE_INCORRECT = 'Файл повреждён или не является поддерживаемым аудио'

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
  recordedAudio: document.getElementById('recordedAudio'),
  pauseBtn: document.getElementById('pauseBtn')
};

/* ================== Состояние ================== */
let activeMode = 'file';
let uploadedFile = null;
let recordedBlob = null;
let timer = 0, sec = 0;
const recorder = new MicRecorder();
let waitingInterval = null;
let inProgress = false;

/* ================== UI ================== */
function showResult(text, secs, ok = true) {
  clearInterval(waitingInterval);
  waitingInterval = null;

  elements.resultEl.textContent = text;
  if (secs) {
    elements.timeVal.textContent = secs;
    elements.timeWrap.hidden = false;
  }
  elements.dlButtons.hidden = !ok;

  if (ok) {
      const payload = { text, secs, ts: Date.now(), model: elements.modelSel.value, lang: elements.langSel.value };
      localStorage.setItem('lastTranscription', JSON.stringify(payload));
  } else {
      localStorage.removeItem('lastTranscription');
  }
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
  const isRecReady  = (activeMode === 'rec'  && recordedBlob);

  const canStart = (isFileReady || isRecReady) && !inProgress;

  elements.recognizeBtn.classList.toggle('btn-disabled', !canStart);
  elements.recognizeBtn.disabled = !canStart;          // ← физически блокируем
}

/* ================== Файл: загрузка и проверка ================== */
elements.audioInput.addEventListener('change', async e => {
  uploadedFile = e.target.files[0] || null;

  // Сброс сообщений
  elements.fileError.style.display   = 'none';
  elements.fileError.textContent     = '';
  elements.fileSupport.style.display = 'block';
  elements.fileSupport.textContent   = FILE_SUPPORT_TEXT;

  if (!uploadedFile) {
    resetFileInput();
    return;
  }

  /* --- 1. проверка расширения ------------------------------------------------------- */
  const isValidExt = ALLOWED_EXTENSIONS
        .some(ext => uploadedFile.name.toLowerCase().endsWith(ext));

  if (!isValidExt) {
    resetFileInput();
    elements.fileSupport.style.display = 'none';
    elements.fileError.style.display   = 'block';
    elements.fileError.textContent     = FILE_ERROR_TEXT;
    return;
  }

  /* --- 2. проверка: файл действительно аудио и не битый ----------------------------- */
  try {
    await testAudioPlayable(uploadedFile);
  } catch {
    resetFileInput();
    elements.fileSupport.style.display = 'none';
    elements.fileError.style.display   = 'block';
    elements.fileError.textContent     = AUDIOFILE_INCORRECT;
    return;
  }

  /* --- 3. отображаем информацию и включаем плеер ----------------------------------- */
  elements.fileSupport.style.display = 'block';
  elements.fileError.style.display   = 'none';

  const url = URL.createObjectURL(uploadedFile);
  elements.filePlayer.src = url;
  elements.filePlayer.classList.remove('d-none');
  elements.filePlayer.onloadedmetadata = () => {
    elements.fileInfo.textContent =
      `${uploadedFile.name} · ${(uploadedFile.size / 1048576).toFixed(2)} МБ · `
      + `${elements.filePlayer.duration.toFixed(1)} сек`;
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
elements.pauseBtn.onclick = () => togglePause();

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
  elements.pauseBtn.classList.remove('d-none');
  elements.pauseBtn.innerHTML = '<i class="fa fa-pause"></i>';
  timer = setInterval(updateTimer, 1000);
  console.info('Запись начата');
}

function togglePause() {
  if (!recorder.isPaused) {
    recorder.pause();
    elements.pauseBtn.innerHTML = '<i class="fa fa-play"></i>';
    elements.recDot?.classList.add('paused');
    console.info('Запись поставлена на паузу');
  } else {
    recorder.resume();
    elements.pauseBtn.innerHTML = '<i class="fa fa-pause"></i>';
    console.info('Запись возобновлена');
  }
}

function stopRec() {
  clearInterval(timer);
  elements.recInd.style.display = 'none';
  elements.micBtn.classList.remove('recording');
  elements.micBtn.innerHTML = '<i class="fa fa-microphone"></i>';
  elements.pauseBtn.classList.add('d-none');
  recorder.stop();
  console.info('Запись остановлена');
}

function updateTimer() {
  if (!recorder?.#recorder || recorder.#recorder.state !== 'recording') return;
  if (!recorder.isPaused) {
    sec++;
    elements.recTime.textContent = `${String(sec/60|0).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  }
}
/* ================== Распознавание ================== */
elements.recognizeBtn.onclick = () => {
  if (inProgress) return;                              

  const isFileReady = (activeMode === 'file' && uploadedFile);
  const isRecReady  = (activeMode === 'rec'  && recordedBlob);
  if (!(isFileReady || isRecReady)) return;

  const formData = new FormData();
  if (isFileReady) formData.append('audio_file', uploadedFile);
  else              formData.append('audio_file', recordedBlob, AUDIO_FILENAME_FOR_UPLOAD);

  formData.append('model',     elements.modelSel.value);
  formData.append('language',  elements.langSel.value);

  /* --- блокируем кнопку и показываем «Обработка…» -------------------- */
  inProgress = true;
  updateRecognizeButtonState();
  showWaiting();

  fetch('/api/transcribe/', {
        method: 'POST',
        body:   formData,
        headers:{ 'X-CSRFToken': getCookie('csrftoken') },
        credentials:'same-origin'
  })
    .then(r => r.json())
    .then(d => showResult(d.text || 'Пустой результат', d.processing_time, true))
    .catch(e => showResult('Ошибка:\n' + e, null, false))
    .finally(() => {                                   
        inProgress = false;
        updateRecognizeButtonState();
    });
};

/* ================== Скачивание ================== */
elements.saveTxtBtn.onclick = () => saveBlob(new Blob([elements.resultEl.textContent], { type: 'text/plain' }), 'transcription.txt');
elements.savePdfBtn.onclick = () => pdfMake.createPdf({ content: elements.resultEl.textContent.split('\n') })
  .download('transcription.pdf');

/* ================== Инициализация ================== */
elements.tabs.forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.mode)));
setTab('file');
/* --- если есть кэш, показываем его сразу --- */
(function restoreLast() {
  /* Если есть готовый результат — выводим его */
  const cached = localStorage.getItem('lastTranscription');
  if (!cached) return;

  try {
      const { text, secs } = JSON.parse(cached);
      if (text) showResult(text, secs);
  } catch (_) {/* повреждённые данные – игнорируем */}
})();


/* ================== Проверка аудиофайла ================== */
function testAudioPlayable(file) {
  return new Promise((resolve, reject) => {
    const probe = document.createElement('audio');
    probe.preload = 'metadata';

    const url = URL.createObjectURL(file);

    probe.oncanplaythrough = () => {
      URL.revokeObjectURL(url);
      resolve(true);
    };

    probe.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Браузер не смог декодировать файл'));
    };

    probe.src = url;
  });
}