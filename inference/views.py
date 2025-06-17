from django.conf import settings
from django.core.files.storage import default_storage
from django.shortcuts import render
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from drf_yasg.utils import swagger_auto_schema
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser
import time
import os
import logging

from .services.recognize_service import RecognizeService
from .serializers import TranscribeInputSerializer
from .services import preprocess, postprocess

LOGGER = logging.getLogger(__name__)

def main_page(request):
    return render(request, 'inference/index.html')

@csrf_exempt
@swagger_auto_schema(
	method='post',
	request_body=TranscribeInputSerializer,
	responses={200: 'Текст успешно получен'}
)
@api_view(['POST'])
@parser_classes([MultiPartParser])
@permission_classes([AllowAny])
def transcribe_api(request):
	try:
		serializer = TranscribeInputSerializer(data=request.data)
		language = request.data.get("language", "ru")

		if not serializer.is_valid():
			LOGGER.warning(f"Некорректный запрос: {serializer.errors}")
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		audio_file = serializer.validated_data['audio_file']
		model_choice = serializer.validated_data['model']

		LOGGER.info(f"Получен запрос на распознавание: файл={audio_file.name}, модель={model_choice}, язык={language}")
		filename = default_storage.save('temp/' + audio_file.name, audio_file)
		file_path = os.path.join(settings.MEDIA_ROOT, filename)

		start_time = time.time()

		chunk_paths = preprocess.preprocess_audio(file_path)
		LOGGER.info(f"Аудиофайл разбит на {len(chunk_paths)} чанков.")

		recognizer = RecognizeService(model_choice)
		texts = []

		for i, chunk_path in enumerate(chunk_paths):
			LOGGER.info(f"Обработка чанка {i+1}/{len(chunk_paths)}")
			chunk_text = recognizer.recognize(chunk_path, language=language)
			texts.append(chunk_text)

		final_text = postprocess.postprocess_text(texts)

		end_time = time.time()
		processing_time = round(end_time - start_time, 2)

		LOGGER.info(f"Обработка завершена")

		return Response({
			"model": model_choice,
			"processing_time": processing_time,
			"text": final_text
		})
	except Exception as exception:
		LOGGER.exception(f"Серверная ошибка при распознавании: {exception}", )
		return Response(
			{"text": "Не удалось обработать аудиофайл. Попробуйте позже."},
			status=status.HTTP_500_INTERNAL_SERVER_ERROR
		)
