import os
import logging
import torch
import torchaudio
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
from .recognizer_base import BaseRecognizer

# Настраиваем логгер
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MODEL_DIR = r"D:\ВКР\project\asr_project\models\wav2vec2-large-ru-5ep"

class Wav2Vec2Recognizer(BaseRecognizer):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Wav2Vec2Recognizer, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.processor = None
        return cls._instance

    def load_model(self):
        if self.model is None or self.processor is None:
            logger.info("Загрузка модели Wav2Vec2...")
            self.processor = Wav2Vec2Processor.from_pretrained(MODEL_DIR)
            self.model = Wav2Vec2ForCTC.from_pretrained(MODEL_DIR)

            if torch.cuda.is_available():
                self.model = self.model.to("cuda").half()

            self.model.eval()
            logger.info("Модель Wav2Vec2 загружена.")

    def recognize(self, audio_path: str, language: str = "ru") -> str:
        self.load_model()

        logger.info(f"Распознавание Wav2Vec2")

        waveform, sr = torchaudio.load(audio_path)
        waveform = waveform.mean(dim=0, keepdim=True)  # mono

        inputs = self.processor(waveform.squeeze().numpy(), sampling_rate=sr, return_tensors="pt", padding=True)
        with torch.no_grad():
            logits = self.model(**inputs).logits
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)

        text = transcription[0].strip()

        return text