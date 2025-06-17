import logging, os, torch, torchaudio, librosa, numpy as np
from pathlib import Path
from pydub import AudioSegment
from glob import escape as glob_escape 
import mutagen

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)
TARGET_SR       = 16_000         
CHUNK_RAW_SEC   = 300            
CHUNK_NET_SEC   = 10             

# ───────────────────────── audio -> набор WAV ──────────
def _iter_decode(src: Path, step_sec: int = CHUNK_RAW_SEC):
    """
    Потоковое чтение ЛЮБОГО формата → mono-WAV AudioSegment <= step_sec.
    MP3/OGG – режем по 5 мин
    """
    meta = mutagen.File(src)                    
    if meta and getattr(meta, "info", None):
        total = meta.info.length               
        offset = 0
        while offset < total - 1e-3:
            dur = min(step_sec, total - offset)
            seg = (AudioSegment.from_file(src,
                                          start_second=offset,
                                          duration=dur)
                     .set_frame_rate(TARGET_SR)
                     .set_channels(1))
            if seg.duration_seconds == 0:
                break
            yield seg
            offset += seg.duration_seconds
    else:
        # mutagen ничего не понял, читаем запись целиком (WEBM, WAV)
        seg = (AudioSegment.from_file(src)
                 .set_frame_rate(TARGET_SR)
                 .set_channels(1))
        if seg.duration_seconds:
            yield seg


def convert_to_wav(input_path: str) -> list[Path]:
    """
    Возвращает список WAV-файлов, лежащих рядом с исходником.
    • WAV -> список из одного элемента
    • MP3/OGG -> my_audio_part_000.wav, my_audio_part_001.wav …
    """
    src = Path(input_path)
    pattern = f"{glob_escape(src.stem)}_part_*.wav"
    if src.suffix.lower() == ".wav":
        return [src]

    ready   = sorted(src.parent.glob(pattern))
    if ready:
        return ready                          

    for i, chunk in enumerate(_iter_decode(src)):
        chunk.export(src.parent / f"{src.stem}_part_{i:03d}.wav", format="wav")

    ready   = sorted(src.parent.glob(pattern))
    LOGGER.info(f"MP3 разбит на {len(ready)} WAV-кусков по {CHUNK_RAW_SEC} с" )
    return ready

def load_and_resample(file_path: str):
    wav, sr = torchaudio.load(file_path)
    wav = wav.mean(dim=0, keepdim=True)
    if sr != TARGET_SR:
        wav = torchaudio.transforms.Resample(sr, TARGET_SR)(wav)
    return wav, TARGET_SR

def split_by_silence(wav_np, top_db):
    """Возвращает интервалы речи. Если не найдено — одна пара (0, len)."""
    ints = librosa.effects.split(wav_np, top_db=top_db)
    if len(ints) == 0:                        
        return np.array([[0, len(wav_np)]])   
    return ints


def chunk_segments_by_intervals(wav_np, intervals, max_samples):
    """Нарезает интервалы на куски <= max_samples."""
    segments, cur, acc = [], [], 0

    for start, end in intervals:
        seg = wav_np[start:end]
        if seg.size == 0:
            continue
        seg_len = len(seg)

        while seg_len > max_samples:
            segments.append(seg[:max_samples])
            seg = seg[max_samples:]
            seg_len = len(seg)

        if acc + seg_len > max_samples and cur:
            segments.append(np.concatenate(cur))
            cur, acc = [], 0

        cur.append(seg)
        acc += seg_len

    if cur:                                   
        segments.append(np.concatenate(cur))

    if not segments:
        segments.append(wav_np[:max_samples])

    return segments

def save_segments(segments, base_path: Path, sr):
    paths = []
    for i, seg in enumerate(segments):
        p = base_path.with_name(f"{base_path.stem}_{i:03d}.wav")
        torchaudio.save(p, torch.tensor(seg).unsqueeze(0), sr)
        paths.append(p)
    LOGGER.info(f"Сохранено чанков: {len(paths)}")
    return paths

def preprocess_audio(file_path: str,
                     chunk_sec: int = CHUNK_NET_SEC,
                     top_db: int = 40) -> list[str]:
    result: list[Path] = []
    for wav_big in convert_to_wav(file_path):
        wav, sr = load_and_resample(str(wav_big))
        ints = split_by_silence(wav.squeeze(0).numpy(), top_db)
        parts = chunk_segments_by_intervals(wav.squeeze(0).numpy(),
                                            ints, sr * chunk_sec)
        result.extend(save_segments(parts, wav_big.with_suffix(""), sr))

    LOGGER.info(f"Готово: {len(result)} финальных WAV-фрагментов по <= {chunk_sec} с")
    return [str(p) for p in result]
