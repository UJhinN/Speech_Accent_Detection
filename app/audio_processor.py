# audio_processor.py
import os
import numpy as np
import librosa
import librosa.display
import cv2
from pydub import AudioSegment
import tempfile
from pathlib import Path

def convert_audio_to_mp3(file_path):
    """แปลงไฟล์เสียงเป็น MP3"""
    try:
        # อ่านไฟล์เสียงด้วย pydub
        audio = AudioSegment.from_file(file_path)

        # สร้างชื่อไฟล์ MP3 ใหม่
        mp3_path = file_path.with_suffix('.mp3')

        # บันทึกเป็น MP3
        audio.export(mp3_path, format="mp3")

        return mp3_path

    except Exception as e:
        print(f"Error converting audio to MP3: {str(e)}")
        return file_path  # กรณีแปลงไม่สำเร็จ ส่งคืนพาธเดิม

def extract_advanced_features(audio_path, max_length=5.0):
    """
    สกัดคุณลักษณะที่หลากหลายจากไฟล์เสียง
    """
    try:
        # โหลดไฟล์เสียง
        y, sr = librosa.load(audio_path, sr=22050)

        # ปรับความยาวเสียงให้เท่ากัน
        target_length = int(max_length * sr)

        if len(y) > target_length:
            y = y[:target_length]
        else:
            # Pad with zeros
            padding = target_length - len(y)
            y = np.pad(y, (0, padding), 'constant')

        # 1. Mel Spectrogram - ให้ความสำคัญมากที่สุด
        mel_spec = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, 
                                                fmax=8000, n_fft=2048, hop_length=512)
        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)

        # 2. MFCC - Mel-frequency cepstral coefficients
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        delta_mfcc = librosa.feature.delta(mfcc)
        delta2_mfcc = librosa.feature.delta(mfcc, order=2)

        # รวม features แบบมัลติ-แชนแนล (3 ช่อง)
        # Normalize features
        mel_spec_norm = (mel_spec_db - np.mean(mel_spec_db)) / (np.std(mel_spec_db) + 1e-10)
        mfcc_norm = (mfcc - np.mean(mfcc)) / (np.std(mfcc) + 1e-10)
        delta_norm = (delta_mfcc - np.mean(delta_mfcc)) / (np.std(delta_mfcc) + 1e-10)

        # ปรับขนาดให้เท่ากัน
        target_shape = (128, 128)
        mel_spec_resized = cv2.resize(mel_spec_norm, (target_shape[1], target_shape[0]))
        mfcc_resized = cv2.resize(mfcc_norm, (target_shape[1], target_shape[0]))
        delta_resized = cv2.resize(delta_norm, (target_shape[1], target_shape[0]))

        # รวมเป็นภาพ 3 ช่อง (RGB-like)
        feature_image = np.stack([mel_spec_resized, mfcc_resized, delta_resized], axis=-1)

        # ทำให้ค่าอยู่ระหว่าง 0-1
        feature_image = (feature_image - feature_image.min()) / (feature_image.max() - feature_image.min() + 1e-10)

        return feature_image
    except Exception as e:
        print(f"Error extracting features from {audio_path}: {str(e)}")
        return None