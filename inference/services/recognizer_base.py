from abc import ABC, abstractmethod

class BaseRecognizer(ABC):
    @abstractmethod
    def load_model(self):
        pass

    @abstractmethod
    def recognize(self, audio_path: str, language: str = "ru") -> str:
        pass