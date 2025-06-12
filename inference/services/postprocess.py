import os
import logging
from django.conf import settings

logger = logging.getLogger(__name__)
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
            logger.exception(f"Ошибка удаления файла {file_path}: {e}")
    logger.info(f"Temp очищен")