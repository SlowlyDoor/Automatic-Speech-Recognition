from django.conf import settings
import logging
import os

LOGGER = logging.getLogger(__name__)
TEMP_DIR = os.path.join(settings.MEDIA_ROOT, 'temp')

def postprocess_text(text):
	clean_temp_folder()
	return " ".join(text).strip().capitalize()


def clean_temp_folder():
    for filename in os.listdir(TEMP_DIR):
        file_path = os.path.join(TEMP_DIR, filename)
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
        except Exception as e:
            LOGGER.exception(f"Ошибка удаления файла {file_path}: {e}")
    LOGGER.info(f"Temp очищен")