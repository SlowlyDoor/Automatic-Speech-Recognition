from django.conf import settings
from pathlib import Path
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import logging
import os
import torch
import torchaudio

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)

BASE_DIR = Path(settings.BASE_DIR)
MODEL_DIR = BASE_DIR / 'models' / 'whisper_small_ru_model_trainer_3ep'

class WhisperRecognizer():
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WhisperRecognizer, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.processor = None
        return cls._instance

    def load_model(self):
        if self.model is None or self.processor is None:
            LOGGER.info("Загрузка модели Whisper...")
            self.processor = WhisperProcessor.from_pretrained(MODEL_DIR)
            self.model = WhisperForConditionalGeneration.from_pretrained(MODEL_DIR)
            self.model.generation_config.forced_decoder_ids = None
            forced_decoder_ids = self.processor.get_decoder_prompt_ids(language="ru", task="transcribe")
            self.model.config.forced_decoder_ids = forced_decoder_ids

            if torch.cuda.is_available():
                self.model = self.model.to("cuda").half()

            self.model.eval()
            LOGGER.info("Модель Whisper загружена.")

    def recognize(self, audio_path: str, language: str = "ru") -> str:
        self.load_model()

        waveform, sr = torchaudio.load(audio_path)
        waveform = waveform.squeeze(0)

        if waveform.numel() / sr < 0.3 or waveform.abs().mean() < 1e-3:
            return ""

        inputs = self.processor(
            waveform.numpy(), sampling_rate=sr, return_tensors="pt"
        ).to(self.model.device)
    
        self.model.config.forced_decoder_ids = (
            self.processor.get_decoder_prompt_ids(language=language, task="transcribe")
        )

        with torch.no_grad():
            predicted_ids = self.model.generate(
                inputs.input_features,
                max_new_tokens=64,
                temperature=0.0,
                no_repeat_ngram_size=3,
            )

        text = self.processor.batch_decode(
        predicted_ids, skip_special_tokens=True
        )[0].strip()

        return text