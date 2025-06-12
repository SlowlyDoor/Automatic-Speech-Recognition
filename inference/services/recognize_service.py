from .recognize_whisper import WhisperRecognizer
from .recognize_wav2vec import Wav2Vec2Recognizer

class RecognizeService:
    def __init__(self, model_name: str):
        if model_name == "whisper":
            self.recognizer = WhisperRecognizer()
        elif model_name == "wav2vec2":
            self.recognizer = Wav2Vec2Recognizer()
        else:
            raise ValueError(f"Unknown model name: {model_name}")

    def recognize(self, audio_path: str, language: str = "ru") -> str:
        return self.recognizer.recognize(audio_path, language)