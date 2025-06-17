from django.apps import AppConfig
import torch
import torchaudio
import os
import logging

from inference.services.recognize_whisper import WhisperRecognizer
from inference.services.recognize_wav2vec import Wav2Vec2Recognizer

LOGGER = logging.getLogger(__name__)

class InferenceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inference'

    def ready(self):
        try:
            LOGGER.info("Старт загрузки моделей при запуске Django...")

            # Загружаем модели
            WhisperRecognizer().load_model()
            Wav2Vec2Recognizer().load_model()

            # Прогрев моделей
            sr = 16000
            dummy_audio = torch.zeros(1, sr)  # 1 секунда
            path = "media/warmup.wav"
            os.makedirs("media", exist_ok=True)
            torchaudio.save(path, dummy_audio, sr)

            LOGGER.info("Прогрев Whisper...")
            WhisperRecognizer().recognize(path)

            LOGGER.info("Прогрев Wav2Vec2...")
            Wav2Vec2Recognizer().recognize(path)

            os.remove(path)

            LOGGER.info("Модели успешно загружены и прогреты при старте Django.")

        except Exception as e:
            LOGGER.exception(f"Ошибка при загрузке или прогреве моделей: {e}")
