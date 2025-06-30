
# Automatic Speech Recognition Web App

Веб-приложение на Django для автоматического распознавания речи с использованием моделей **Whisper** и **Wav2Vec2**.

---

## Описание

Приложение позволяет загружать аудиофайлы, выбирать модель распознавания речи и получать результат в текстовом виде.  
Интерфейс доступен через браузер, а также через REST API.

Модели для распознавания необходимо заранее скачать в локальную папку `models/`.

---

## Требования

- Python 3.11+
- Git
- Виртуальное окружение (venv)

---

## Установка проекта

### Склонировать репозиторий

```bash
git clone https://github.com/SlowlyDoor/Automatic-Speech-Recognition.git
cd Automatic-Speech-Recognition
```

### Создать виртуальное окружение

Виртуальное окружение позволяет изолировать зависимости проекта от глобальных библиотек Python, чтобы избежать конфликтов версий.  

Создать и активировать `venv`:

```bash
python -m venv venv
venv\Scripts\activate    # для Windows
# source venv/bin/activate    # для Linux / MacOS
```

После активации `venv` вы можете устанавливать зависимости, и они будут сохраняться только внутри текущего проекта.

### Установить зависимости

```bash
python.exe -m pip install --upgrade pip
pip install -r requirements.txt
```

---

## Собрать статические файлы

Если вы доплнительно добавляете собственные CSS, JS или изображения в папку `static/`, и хотите запустить проект, необходимо собрать все статические файлы в одну директорию с помощью команды:

```bash
python manage.py collectstatic
```

---

## Скачивание моделей

**Важно:** модели для распознавания речи не включены в репозиторий!  
Их необходимо скачать вручную из HuggingFace Hub.

Выполните следующие команды:

```bash
git clone https://huggingface.co/internalhell/whisper_small_ru_model_trainer_3ep

git clone https://huggingface.co/internalhell/wav2vec2-large-ru-5ep
```

После этого структура папки `models/` будет следующая:

```plaintext
models/
├── whisper_small_ru_model_trainer_3ep/
└── wav2vec2-large-ru-5ep/
```
---

## Установка ffmpeg

Для поддержки конвертации аудиофайлов в формат WAV используется библиотека `pydub`, которая требует установленного [ffmpeg](https://ffmpeg.org/).

Установите `ffmpeg` одним из следующих способов:

- **Windows:**  
  Скачайте готовый бинарник: https://www.gyan.dev/ffmpeg/builds/  
  Добавьте путь к `ffmpeg/bin` в переменную среды `PATH`.

- **Linux (Ubuntu/Debian):**

```bash
sudo apt update
sudo apt install ffmpeg
```

---

## Настройка базы данных

Примените миграции БД:

```bash
python manage.py migrate
```

Для добавления суперпользователя:
```bash
python manage.py createsuperuser
```

---

## Запуск сервера

Запустите сервер:

```bash
python manage.py runserver
```

---

## Открытие в браузере

После запуска сервера:

Открыть главную страницу:

```
http://127.0.0.1:8000/
```

Открыть Swagger-документацию REST API:

```
http://127.0.0.1:8000/swagger/
```

---

## Примечания

- При первом запуске происходит **прогрев моделей** (создаётся и удаляется временный файл `warmup.wav`).
- Логи работы приложения сохраняются в файл:

```plaintext
logs/asr.log
```

- Временные аудиофайлы обрабатываются и сохраняются в папку:

```plaintext
media/temp/
```

- Папка `models/` используется для хранения локальных моделей.

---

## Структура проекта

```plaintext
Automatic-Speech-Recognition/
├── asr_project/
├── inference/
├── services/
├── utils/
├── templates/
├── static/
├── media/                  # Временные файлы, папка создаётся автоматически
├── models/                 # Сюда нужно вручную скачать модели с HuggingFace
│   ├── whisper_small_ru_model_trainer_3ep/
│   └── wav2vec2-large-ru-5ep/
├── logs/
│   └── asr.log
├── db.sqlite3
├── manage.py
├── requirements.txt
└── README.md
```

---

## Важно

Без скачанных моделей папка `models/` будет пустой → необходимо вручную скачать модели, иначе приложение не будет работать.

Используемые модели были предварительно обучены и протестированы.

---

## Совет для режима разработки

При разработке интерфейса (HTML/CSS/JS) браузеры часто кэшируют статические файлы.  
Из-за этого после изменений статики можно не увидеть обновления.

Чтобы этого избежать:

- Во вкладке **Network** поставьте галочку **Disable cache** (Отключить кэш)

