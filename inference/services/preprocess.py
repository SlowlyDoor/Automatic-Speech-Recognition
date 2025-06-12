import os
import logging
import torch
import torchaudio
import numpy as np
from pydub import AudioSegment
import librosa

# Конфигурация логгера
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Можно добавить сюда хендлер при инициализации, например StreamHandler

TARGET_SR = 16000  # Частота дискретизации

def convert_to_wav(input_path):
    ext = os.path.splitext(input_path)[1].lower()
    if ext == '.wav':
        return input_path

    output_path = os.path.splitext(input_path)[0] + "_converted.wav"
    if not os.path.exists(output_path):
        audio = AudioSegment.from_file(input_path)
        audio.export(output_path, format="wav")
        logger.info(f"Конвертирован в WAV: {output_path}")
    return output_path

def load_and_resample(file_path):
    waveform, sr = torchaudio.load(file_path)
    waveform = waveform.mean(dim=0, keepdim=True)  # моно
    if sr != TARGET_SR:
        resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=TARGET_SR)
        waveform = resampler(waveform)
        sr = TARGET_SR
    return waveform, sr

def split_by_silence(waveform_np, top_db):
    logger.info("Выполняется удаление пауз тишины")
    intervals = librosa.effects.split(waveform_np, top_db=top_db)
    logger.info(f"Найдено {len(intervals)} речевых интервалов")
    return intervals

def chunk_segments_by_intervals(waveform_np, intervals, max_samples):
    segments = []
    current_chunk = []
    current_len = 0

    for start, end in intervals:
        seg_len = end - start
        if current_len + seg_len > max_samples:
            segments.append(np.concatenate(current_chunk))
            current_chunk = [waveform_np[start:end]]
            current_len = seg_len
        else:
            current_chunk.append(waveform_np[start:end])
            current_len += seg_len

    if current_chunk:
        segments.append(np.concatenate(current_chunk))

    return segments

def save_segments(segments, base_path, sr):
	output_paths = []
	for i, chunk in enumerate(segments):
		chunk_tensor = torch.tensor(chunk).unsqueeze(0)
		out_path = f"{base_path}_{i:03d}.wav"
		torchaudio.save(out_path, chunk_tensor, sr)
		output_paths.append(out_path)
	logger.info(f"Сохранено чанков: {len(output_paths)}")
	return output_paths

def preprocess_audio(file_path, chunk_sec=10, top_db=40):
	"""
	Основной препроцессинг:
	- компенсация шума
	- удаление пауз тишины
	"""
	logger.info(f"Начало обработки аудиофайла: {file_path}")

	file_path = convert_to_wav(file_path)
	waveform, sr = load_and_resample(file_path)

	waveform_np = waveform.squeeze(0).numpy()

	segments = []
	max_samples = sr * chunk_sec

	intervals = split_by_silence(waveform_np, top_db)
	segments = chunk_segments_by_intervals(waveform_np, intervals, max_samples)

	base_path = os.path.splitext(file_path)[0] + "_chunk"
	output_paths = save_segments(segments, base_path, sr)

	logger.info(f"Препроцессинг завершён. Чанков: {len(output_paths)}\n")
	return output_paths
