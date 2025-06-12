import os
import logging
import torch
import torchaudio
from transformers import WhisperProcessor, WhisperForConditionalGeneration
from .recognizer_base import BaseRecognizer

# Настраиваем логгер
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MODEL_DIR = r"D:\ВКР\project\asr_project\models\whisper_small_ru_model_trainer_3ep"

class WhisperRecognizer(BaseRecognizer):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WhisperRecognizer, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.processor = None
        return cls._instance

    def load_model(self):
        if self.model is None or self.processor is None:
            logger.info("Загрузка модели Whisper...")
            self.processor = WhisperProcessor.from_pretrained(MODEL_DIR)
            self.model = WhisperForConditionalGeneration.from_pretrained(MODEL_DIR)
            self.model.generation_config.forced_decoder_ids = None
            forced_decoder_ids = self.processor.get_decoder_prompt_ids(language="ru", task="transcribe")
            self.model.config.forced_decoder_ids = forced_decoder_ids

            if torch.cuda.is_available():
                self.model = self.model.to("cuda").half()

            self.model.eval()
            logger.info("Модель Whisper загружена.")

    def recognize(self, audio_path: str, language: str = "ru") -> str:
        self.load_model()

        logger.info(f"Распознавание Whisper")

        forced_decoder_ids = self.processor.get_decoder_prompt_ids(language=language, task="transcribe")
        self.model.config.forced_decoder_ids = forced_decoder_ids

        waveform, sr = torchaudio.load(audio_path)
        waveform = waveform.squeeze(0)

        inputs = self.processor(waveform.numpy(), sampling_rate=sr, return_tensors="pt")
        input_features = inputs.input_features

        with torch.no_grad():
            predicted_ids = self.model.generate(input_features)

        text = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()

        return text