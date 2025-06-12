# inference/apps.py

from django.apps import AppConfig
import torch
import torchaudio
import os
import logging

from inference.services.recognize_whisper import WhisperRecognizer
from inference.services.recognize_wav2vec import Wav2Vec2Recognizer

# Настраиваем логгер
logger = logging.getLogger(__name__)

class InferenceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inference'

    def ready(self):
        try:
            logger.info("Старт загрузки моделей при запуске Django...")

            # Загружаем модели (Singleton → будут грузиться только 1 раз)
            WhisperRecognizer().load_model()
            Wav2Vec2Recognizer().load_model()

            # Прогрев моделей (1 секунда тишины)
            sr = 16000
            dummy_audio = torch.zeros(1, sr)  # 1 секунда
            path = "media/warmup.wav"
            os.makedirs("media", exist_ok=True)
            torchaudio.save(path, dummy_audio, sr)

            logger.info("Прогрев Whisper...")
            WhisperRecognizer().recognize(path)

            logger.info("Прогрев Wav2Vec2...")
            Wav2Vec2Recognizer().recognize(path)

            os.remove(path)

            logger.info("Модели успешно загружены и прогреты при старте Django.")

        except Exception as e:
            logger.exception(f"Ошибка при загрузке или прогреве моделей: {e}")
