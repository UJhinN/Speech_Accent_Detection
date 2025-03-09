from flask import Flask, request, jsonify, render_template, redirect, url_for, send_from_directory
import tensorflow as tf
import librosa
import numpy as np
import os
import tempfile
import base64
import logging
import traceback
import soundfile as sf
import joblib
import cv2
from datetime import datetime
# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, static_folder='static')

# Define model paths
MODEL_DIR = r'D:\Y2.2\Speech_Accent_Detection\Model\Model'
CNN_RNN_MODEL_PATH = os.path.join(MODEL_DIR, r'D:\Y2.2\Speech_Accent_Detection\Model\Model\accent_cnn_rnn_model.h5')
RESNET_MODEL_PATH = os.path.join(MODEL_DIR, r'D:\Y2.2\Speech_Accent_Detection\Model\Model\accent_resnet_model.h5')
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, r'D:\Y2.2\Speech_Accent_Detection\Model\Model\label_encoder.pkl')

# Create temporary directory for audio files
TEMP_AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp_audios')
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
logging.info(f"Created temporary audio directory at: {TEMP_AUDIO_DIR}")

# List of accents the model can predict - updated for your specific needs
class_names = [
    "Arabic", "English", "French", "Japanese", "Mandarin", "Thai"
]

# Load models
try:
    logging.info("Loading models...")
    
    # Try to load CNN+RNN model first
    if os.path.exists(CNN_RNN_MODEL_PATH):
        model = tf.keras.models.load_model(CNN_RNN_MODEL_PATH)
        logging.info(f"CNN+RNN model loaded successfully from {CNN_RNN_MODEL_PATH}")
        model_type = "CNN+RNN"
    # Fall back to ResNet if CNN+RNN is not available
    elif os.path.exists(RESNET_MODEL_PATH):
        model = tf.keras.models.load_model(RESNET_MODEL_PATH)
        logging.info(f"ResNet model loaded successfully from {RESNET_MODEL_PATH}")
        model_type = "ResNet"
    else:
        logging.error("No model files found")
        model = None
        model_type = None
    
    # Load label encoder if it exists
    if os.path.exists(LABEL_ENCODER_PATH):
        label_encoder = joblib.load(LABEL_ENCODER_PATH)
        logging.info(f"Label encoder loaded successfully from {LABEL_ENCODER_PATH}")
    else:
        logging.warning("Label encoder not found, using predefined class names")
        label_encoder = None
    
except Exception as e:
    logging.error(f"Error loading model: {str(e)}", exc_info=True)
    model = None
    model_type = None
    label_encoder = None

def convert_audio_to_wav(input_path, output_path=None):
    """
    Convert audio file to WAV format compatible with librosa
    """
    if output_path is None:
        output_path = os.path.splitext(input_path)[0] + "_converted.wav"
    
    try:
        logging.info(f"Converting audio file from {input_path} to {output_path}")
        
        # Read audio file with soundfile
        data, samplerate = sf.read(input_path)
        
        # Save as properly formatted WAV
        sf.write(output_path, data, samplerate, subtype='PCM_16')
        
        logging.info(f"Audio conversion successful: {output_path}")
        return output_path
    except Exception as e:
        logging.error(f"Error converting audio: {str(e)}", exc_info=True)
        raise

def extract_advanced_features(file_path, target_sample_rate=22050, max_length=5.0):
    """
    Extract advanced features from audio file with improved support for MP3
    """
    logging.info(f"Extracting advanced features from: {file_path}")
    
    try:
        # เพิ่มการจัดการข้อผิดพลาดและการทำงานกับไฟล์ MP3
        file_ext = os.path.splitext(file_path)[1].lower()
        
        try:
            # ใช้ librosa โดยตรง - ควรรองรับทั้ง MP3 และฟอร์แมตอื่นๆ
            y, sr = librosa.load(file_path, sr=target_sample_rate, mono=True, res_type='kaiser_fast')
            logging.info(f"Successfully loaded audio file with librosa: {file_path}")
        except Exception as load_error:
            logging.warning(f"Standard librosa load failed: {str(load_error)}")
            
            # ถ้าใช้ librosa ไม่ได้ ลองใช้ pydub (ถ้ามี)
            try:
                import io
                from pydub import AudioSegment
                
                # โหลดไฟล์ด้วย pydub (รองรับหลายฟอร์แมตรวมถึง MP3)
                if file_ext == '.mp3':
                    audio = AudioSegment.from_mp3(file_path)
                elif file_ext == '.wav':
                    audio = AudioSegment.from_wav(file_path)
                elif file_ext == '.ogg':
                    audio = AudioSegment.from_ogg(file_path)
                else:
                    audio = AudioSegment.from_file(file_path)
                
                # แปลงเป็น numpy array ที่ librosa ใช้ได้
                y = np.array(audio.get_array_of_samples()).astype(np.float32) / 32768.0  # เปลี่ยนจาก int16 เป็น float32
                
                # ถ้าเป็นสเตอริโอ แปลงเป็นโมโน
                if audio.channels > 1:
                    y = y.reshape((-1, audio.channels)).mean(axis=1)
                
                # รีแซมเปิลถ้าจำเป็น
                if audio.frame_rate != target_sample_rate:
                    y = librosa.resample(y, orig_sr=audio.frame_rate, target_sr=target_sample_rate)
                
                sr = target_sample_rate
                logging.info(f"Successfully loaded audio with pydub: {file_path}")
            except ImportError:
                logging.warning("pydub not available, falling back to soundfile")
                # ถ้าไม่มี pydub ลองใช้ soundfile
                try:
                    import soundfile as sf
                    y, sr = sf.read(file_path)
                    # แปลงเป็นโมโนถ้าเป็นสเตอริโอ
                    if len(y.shape) > 1:
                        y = y.mean(axis=1)
                    # รีแซมเปิลถ้าจำเป็น
                    if sr != target_sample_rate:
                        y = librosa.resample(y, orig_sr=sr, target_sr=target_sample_rate)
                    sr = target_sample_rate
                    logging.info(f"Successfully loaded audio with soundfile: {file_path}")
                except Exception as sf_error:
                    logging.error(f"All audio loading methods failed: {str(sf_error)}")
                    raise
            except Exception as pydub_error:
                logging.error(f"pydub loading failed: {str(pydub_error)}")
                raise
        
        # Adjust audio length
        target_length = int(max_length * sr)
        
        if len(y) > target_length:
            y = y[:target_length]
        else:
            # Pad with zeros
            padding = target_length - len(y)
            y = np.pad(y, (0, padding), 'constant')
        
        # 1. Mel Spectrogram
        mel_spec = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, 
                                                fmax=8000, n_fft=2048, hop_length=512)
        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
        
        # 2. MFCC - Mel-frequency cepstral coefficients
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        delta_mfcc = librosa.feature.delta(mfcc)
        
        # Normalize features
        mel_spec_norm = (mel_spec_db - np.mean(mel_spec_db)) / (np.std(mel_spec_db) + 1e-10)
        mfcc_norm = (mfcc - np.mean(mfcc)) / (np.std(mfcc) + 1e-10)
        delta_norm = (delta_mfcc - np.mean(delta_mfcc)) / (np.std(delta_mfcc) + 1e-10)
        
        # Resize to target shape
        target_shape = (128, 128)
        mel_spec_resized = cv2.resize(mel_spec_norm, (target_shape[1], target_shape[0]))
        mfcc_resized = cv2.resize(mfcc_norm, (target_shape[1], target_shape[0]))
        delta_resized = cv2.resize(delta_norm, (target_shape[1], target_shape[0]))
        
        # Combine into 3-channel image
        feature_image = np.stack([mel_spec_resized, mfcc_resized, delta_resized], axis=-1)
        
        # Normalize to [0, 1]
        feature_image = (feature_image - feature_image.min()) / (feature_image.max() - feature_image.min() + 1e-10)
        
        # Add batch dimension
        feature_image = np.expand_dims(feature_image, axis=0)
        
        logging.info(f"Feature extraction successful. Shape: {feature_image.shape}")
        return feature_image
        
    except Exception as e:
        logging.error(f"Error extracting advanced features: {str(e)}", exc_info=True)
        logging.error(traceback.format_exc())
        raise

def fallback_feature_extraction(file_path, target_sample_rate=44100, n_mfcc=13):
    """
    Fallback feature extraction method with improved MP3 support
    """
    logging.info(f"Using fallback feature extraction for: {file_path}")
    
    try:
        # Check file size and type
        file_size = os.path.getsize(file_path)
        file_ext = os.path.splitext(file_path)[1].lower()
        logging.info(f"Audio file size: {file_size} bytes, extension: {file_ext}")
        
        if file_size == 0:
            raise ValueError("Audio file is empty")
        
        # ใช้วิธีหลายแบบในการโหลดไฟล์เสียง
        y = None
        sr = None
        
        # วิธีที่ 1: ใช้ librosa โดยตรง พร้อมกับ MP3 decoder
        try:
            logging.info("Trying to load audio with librosa directly")
            # ใช้ options res_type='kaiser_fast' เพื่อเพิ่มความเร็ว และ mono=True เพื่อบังคับให้เป็นโมโน
            y, sr = librosa.load(file_path, sr=target_sample_rate, res_type='kaiser_fast', mono=True)
            logging.info(f"Successfully loaded audio with librosa: sample rate = {sr}, length = {len(y)}")
        except Exception as e:
            logging.warning(f"librosa direct loading failed: {str(e)}")
            
            # วิธีที่ 2: ลองใช้ pydub ถ้ามี (รองรับ MP3 ได้ดี)
            try:
                logging.info("Trying to load audio with pydub")
                from pydub import AudioSegment
                
                if file_ext == '.mp3':
                    audio = AudioSegment.from_mp3(file_path)
                elif file_ext == '.wav':
                    audio = AudioSegment.from_wav(file_path)
                elif file_ext == '.ogg':
                    audio = AudioSegment.from_ogg(file_path)
                else:
                    audio = AudioSegment.from_file(file_path)
                
                # แปลงเป็น numpy array
                y = np.array(audio.get_array_of_samples()).astype(np.float32) / 32768.0
                
                # แปลงจากสเตอริโอเป็นโมโนถ้าจำเป็น
                if audio.channels > 1:
                    y = y.reshape((-1, audio.channels)).mean(axis=1)
                
                # รีแซมเปิลถ้าจำเป็น
                if audio.frame_rate != target_sample_rate:
                    y = librosa.resample(y, orig_sr=audio.frame_rate, target_sr=target_sample_rate)
                
                sr = target_sample_rate
                logging.info(f"Successfully loaded audio with pydub: length = {len(y)}")
            except (ImportError, Exception) as pydub_error:
                logging.warning(f"pydub loading failed: {str(pydub_error)}")
                
                # วิธีที่ 3: ลองแปลงเป็น WAV ก่อนแล้วค่อยโหลด
                try:
                    logging.info("Trying to convert to WAV before loading")
                    converted_file = os.path.join(os.path.dirname(file_path), "fallback_converted.wav")
                    try:
                        converted_file = convert_audio_to_wav(file_path, converted_file)
                        y, sr = librosa.load(converted_file, sr=target_sample_rate)
                        logging.info(f"Successfully loaded converted WAV file: sample rate = {sr}, length = {len(y)}")
                        
                        # ลบไฟล์ที่แปลงแล้ว
                        try:
                            os.remove(converted_file)
                        except:
                            pass
                    except Exception as conversion_error:
                        logging.warning(f"Audio conversion failed: {str(conversion_error)}")
                        raise
                except Exception as wav_error:
                    logging.error(f"All audio loading methods failed: {str(wav_error)}")
                    raise ValueError(f"Unable to load audio file {file_path} with any method")
        
        # Check if audio data is valid
        if y is None or len(y) == 0:
            raise ValueError("Audio data is empty after loading")
        
        # Extract MFCC features
        try:
            # ใช้ n_mfcc เพิ่มขึ้นเพื่อรายละเอียดที่มากขึ้น
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
            logging.info(f"MFCC extracted: shape = {mfcc.shape}")
            
            # ลองเพิ่ม feature อื่นๆ เช่น spectral centroid
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
            # zero crossing rate จะช่วยแยกเสียงพูดจากเสียงอื่นๆ 
            zero_crossing_rate = librosa.feature.zero_crossing_rate(y)
            
            # Normalize features
            mfcc = (mfcc - np.mean(mfcc)) / (np.std(mfcc) + 1e-10)
            spectral_centroid = (spectral_centroid - np.mean(spectral_centroid)) / (np.std(spectral_centroid) + 1e-10)
            zero_crossing_rate = (zero_crossing_rate - np.mean(zero_crossing_rate)) / (np.std(zero_crossing_rate) + 1e-10)
            
            # คำนวณค่าเฉลี่ยของแต่ละ feature
            mfcc_features = np.mean(mfcc, axis=1)
            centroid_features = np.mean(spectral_centroid, axis=1)
            zcr_features = np.mean(zero_crossing_rate, axis=1)
            
            # รวม features ทั้งหมด
            combined_features = np.concatenate([mfcc_features, centroid_features, zcr_features])
            logging.info(f"Combined features shape: {combined_features.shape}")
            
            # Reshape to match model input shape
            features = combined_features.reshape(1, -1, 1)
            logging.info(f"Final feature shape for model: {features.shape}")
            
            return features
            
        except Exception as e:
            logging.error(f"Error extracting features: {str(e)}", exc_info=True)
            
            # ถ้าวิธีนี้ล้มเหลว ให้ใช้วิธีพื้นฐานที่สุด
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            mfcc_features = np.mean(mfcc, axis=1)
            features = mfcc_features.reshape(1, -1, 1)
            logging.info(f"Using simple MFCC features as last resort. Shape: {features.shape}")
            
            return features
        
    except Exception as e:
        logging.error(f"Error in fallback feature extraction: {str(e)}", exc_info=True)
        logging.error(traceback.format_exc())
        raise



@app.route('/')
def index():
    return render_template('index.html')

# แก้ไขฟังก์ชัน upload_file ใน app.py

@app.route('/upload', methods=['POST'])
def upload_file():
    logging.info("Received file upload request")
    
    if 'audio_file' not in request.files:
        logging.warning("No audio_file in request")
        return jsonify({'error': 'ไม่พบไฟล์เสียง กรุณาเลือกไฟล์เสียงก่อน'}), 400
    
    audio_file = request.files['audio_file']
    
    if audio_file.filename == '':
        logging.warning("Empty filename")
        return jsonify({'error': 'ไม่ได้เลือกไฟล์เสียง'}), 400
    
    # Save temporary file
    temp_path = os.path.join(TEMP_AUDIO_DIR, "uploaded_audio.wav")
    audio_file.save(temp_path)
    logging.info(f"Temporary file saved at: {temp_path}")
    
    try:
        # Check file size
        if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
            logging.error("Audio file is missing or empty")
            return jsonify({'error': 'ไฟล์เสียงมีปัญหาหรือว่างเปล่า'}), 400
        
        # Process audio and get predictions
        results, model_info = process_audio(temp_path)
        
        # Delete temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return render_template('result.html', results=results, model_info=model_info)
        
    except Exception as e:
        logging.error(f"Error during processing: {str(e)}", exc_info=True)
        # In case of error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        # แก้ไขเพื่อแสดงข้อความผิดพลาดที่หน้า result
        error_message = f"เกิดข้อผิดพลาด: {str(e)}"
        return render_template('result.html', error_message=error_message, results=None, model_info=None)

# ปรับปรุงฟังก์ชัน process_audio เพื่อรองรับไฟล์ MP3 โดยตรง
def process_audio(file_path):
    """
    Process audio file and get predictions
    """
    try:
        # Check file type
        file_ext = os.path.splitext(file_path)[1].lower()
        logging.info(f"Processing file with extension: {file_ext}")
        
        # ตรวจสอบว่าเป็นไฟล์ MP3 ที่อยู่ใน temp_audios หรือไม่
        if 'temp_audios' in file_path and file_ext == '.mp3':
            logging.info("Detected pre-recorded MP3 file in temp_audios folder, using fast processing")
            # ใช้ fallback_feature_extraction โดยตรงเพื่อความเร็ว
            features = fallback_feature_extraction(file_path)
        else:
            # ใช้กระบวนการปกติสำหรับไฟล์อื่นๆ
            # Create a copy for processing
            temp_processing_path = file_path
            should_delete_temp = False
            
            # Try advanced feature extraction first with the file as-is
            try:
                features = extract_advanced_features(file_path)
            except Exception as e:
                logging.warning(f"Direct feature extraction failed: {str(e)}. Trying fallback method.")
                
                # Try converting to WAV if it's not already a WAV file
                if file_ext != '.wav':
                    try:
                        wav_temp_path = os.path.join(TEMP_AUDIO_DIR, "processing_audio.wav")
                        temp_processing_path = convert_audio_to_wav(file_path, wav_temp_path)
                        should_delete_temp = True
                        features = extract_advanced_features(temp_processing_path)
                        logging.info("Successfully extracted features after WAV conversion")
                    except Exception as conv_error:
                        logging.warning(f"Feature extraction after WAV conversion failed: {str(conv_error)}. Trying fallback feature extraction.")
                        features = fallback_feature_extraction(file_path)
                else:
                    # If it's already a WAV file but extraction failed, try fallback
                    features = fallback_feature_extraction(file_path)
            
            # Clean up temporary file if created
            if should_delete_temp and temp_processing_path != file_path and os.path.exists(temp_processing_path):
                try:
                    os.remove(temp_processing_path)
                    logging.info(f"Removed temporary processing file: {temp_processing_path}")
                except Exception as e:
                    logging.warning(f"Failed to remove temporary file: {str(e)}")
        
        # Make prediction
        logging.info("Predicting accent...")
        predictions = model.predict(features)
        logging.info(f"Raw prediction: {predictions}")
        
        # Sort results by confidence
        sorted_indices = np.argsort(predictions[0])[::-1]
        
        # Create results dictionary
        results = []
        
        # If we have a label encoder, use it to get the class names
        if label_encoder is not None:
            classes = label_encoder.classes_
            for i in sorted_indices:
                if i < len(classes):  # Safety check
                    results.append({
                        'accent': classes[i],
                        'confidence': float(predictions[0][i] * 100)
                    })
        # Otherwise use the predefined class names
        else:
            for i in sorted_indices:
                if i < len(class_names):  # Safety check
                    results.append({
                        'accent': class_names[i],
                        'confidence': float(predictions[0][i] * 100)
                    })
        
        logging.info(f"Top predictions: {results[:3]}")
        
        # Add model type to results
        model_info = {
            'model_type': model_type
        }
        
        return results, model_info
    except Exception as e:
        logging.error(f"Error processing audio: {str(e)}", exc_info=True)
        raise

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

if __name__ == "__main__":
    try:
        # Check if required libraries are available
        import soundfile as sf
        import cv2
        logging.info("Required libraries available")
    except ImportError as e:
        logging.warning(f"Required library not available: {str(e)}")
        logging.warning("Try installing missing libraries with pip")
    
    # Create templates directory if it doesn't exist
    templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    os.makedirs(templates_dir, exist_ok=True)
    
    # Create static/js directory if it doesn't exist
    static_js_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'js')
    os.makedirs(static_js_dir, exist_ok=True)
    
    logging.info(f"Server starting... templates dir: {templates_dir}, static dir: {app.static_folder}")
    app.run(debug=True)