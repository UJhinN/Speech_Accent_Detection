from flask import Flask, request, jsonify, render_template, redirect, url_for, send_from_directory
import tensorflow as tf
import librosa
import numpy as np
import os
import tempfile
import base64
import re
import logging
import traceback
import soundfile as sf

# ตั้งค่า logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, static_folder='static')

# กำหนดเส้นทางที่ถูกต้องของโมเดล
MODEL_PATH = 'Model/cnn_tunning.h5'

# สร้างไดเร็กทอรีชั่วคราวสำหรับไฟล์เสียง
TEMP_AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp_audios')
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
logging.info(f"Created temporary audio directory at: {TEMP_AUDIO_DIR}")

# ตรวจสอบว่าไฟล์โมเดลมีอยู่หรือไม่
if not os.path.exists(MODEL_PATH):
    logging.warning(f"Warning: Model file not found at {MODEL_PATH}")
    logging.info(f"Current working directory: {os.getcwd()}")
    logging.info(f"Looking for model in: {os.path.abspath(MODEL_PATH)}")
    # ลองค้นหาไฟล์โมเดลในโฟลเดอร์ Model
    if os.path.exists('Model'):
        model_files = [f for f in os.listdir('Model') if f.endswith('.h5') or f.endswith('.keras')]
        if model_files:
            logging.info(f"Found model files in Model directory: {model_files}")
            MODEL_PATH = os.path.join('Model', model_files[0])
            logging.info(f"Using model: {MODEL_PATH}")

# โหลดโมเดล
try:
    logging.info(f"Loading model from {MODEL_PATH}...")
    model = tf.keras.models.load_model(MODEL_PATH)
    logging.info("Model loaded successfully!")
except Exception as e:
    logging.error(f"Error loading model: {str(e)}", exc_info=True)
    model = None

# รายชื่อสำเนียงที่โมเดลสามารถทำนายได้
class_names = [
    "Arabic", "Dutch", "English", "French", "German",
    "Italian", "Korean", "Mandarin", "Polish", "Portuguese",
    "Russian", "Spanish", "Turkish"
]

def convert_audio_to_wav(input_path, output_path=None):
    """
    แปลงไฟล์เสียงเป็นรูปแบบ WAV ที่สามารถใช้กับ librosa ได้
    """
    if output_path is None:
        output_path = os.path.splitext(input_path)[0] + "_converted.wav"
    
    try:
        logging.info(f"Converting audio file from {input_path} to {output_path}")
        
        # ลองอ่านไฟล์เสียงด้วย soundfile
        data, samplerate = sf.read(input_path)
        
        # บันทึกเป็น WAV ที่ถูกต้อง
        sf.write(output_path, data, samplerate, subtype='PCM_16')
        
        logging.info(f"Audio conversion successful: {output_path}")
        return output_path
    except Exception as e:
        logging.error(f"Error converting audio: {str(e)}", exc_info=True)
        raise

def preprocess_audio(file_path, target_sample_rate=44100, n_mfcc=13):
    """
    แปลงไฟล์เสียงให้เป็นรูปแบบที่โมเดลรับได้
    """
    logging.info(f"Processing audio file: {file_path}")
    
    try:
        # ตรวจสอบขนาดไฟล์ก่อน
        file_size = os.path.getsize(file_path)
        logging.info(f"Audio file size: {file_size} bytes")
        
        if file_size == 0:
            raise ValueError("Audio file is empty")
        
        # ลองแปลงไฟล์เสียงให้เป็นรูปแบบ WAV ที่เข้ากันได้กับ librosa
        converted_file = os.path.join(os.path.dirname(file_path), "converted_audio.wav")
        try:
            converted_file = convert_audio_to_wav(file_path, converted_file)
            file_path = converted_file
            logging.info(f"Using converted audio file: {file_path}")
        except Exception as conversion_error:
            logging.warning(f"Audio conversion failed: {str(conversion_error)}. Will try with original file.")
        
        # โหลดไฟล์เสียงและปรับ sample rate
        try:
            y, sr = librosa.load(file_path, sr=target_sample_rate)
            logging.info(f"Audio loaded successfully: sample rate = {sr}, length = {len(y)}")
        except Exception as e:
            logging.error(f"Error loading audio with librosa: {str(e)}", exc_info=True)
            raise
        
        # ตรวจสอบว่าข้อมูลเสียงมีค่ามากกว่า 0
        if len(y) == 0:
            raise ValueError("Audio data is empty after loading")
        
        # สกัด MFCC features
        try:
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
            logging.info(f"MFCC extracted: shape = {mfcc.shape}")
        except Exception as e:
            logging.error(f"Error extracting MFCC: {str(e)}", exc_info=True)
            raise
        
        # Normalize features
        try:
            mfcc = (mfcc - np.mean(mfcc)) / (np.std(mfcc) + 1e-10)  # เพิ่ม epsilon เพื่อป้องกัน division by zero
        except Exception as e:
            logging.error(f"Error normalizing MFCC: {str(e)}", exc_info=True)
            raise
        
        # เตรียม features สำหรับโมเดล
        mfcc_features = np.mean(mfcc, axis=1)
        logging.info(f"Mean features shape: {mfcc_features.shape}")
        
        # Reshape เพื่อให้ตรงกับ input shape ของโมเดล
        mfcc_features = mfcc_features.reshape(1, -1, 1)
        logging.info(f"Final feature shape for model: {mfcc_features.shape}")
        
        # ลบไฟล์ที่แปลงหากมีการสร้าง
        if converted_file != file_path and os.path.exists(converted_file):
            try:
                os.remove(converted_file)
                logging.info(f"Removed temporary converted file: {converted_file}")
            except Exception as e:
                logging.warning(f"Failed to remove temporary file: {str(e)}")
        
        return mfcc_features
        
    except Exception as e:
        logging.error(f"Error processing audio: {str(e)}", exc_info=True)
        # ลองแสดง stacktrace เพื่อดูว่าเกิดข้อผิดพลาดที่ไหน
        logging.error(traceback.format_exc())
        raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    logging.info("Received file upload request")
    
    if 'audio_file' not in request.files:
        logging.warning("No audio_file in request")
        return redirect(request.url)
    
    audio_file = request.files['audio_file']
    
    if audio_file.filename == '':
        logging.warning("Empty filename")
        return redirect(request.url)
    
    # บันทึกไฟล์ชั่วคราว
    temp_path = os.path.join(TEMP_AUDIO_DIR, "uploaded_audio.wav")
    audio_file.save(temp_path)
    logging.info(f"Temporary file saved at: {temp_path}")
    
    try:
        # ตรวจสอบขนาดไฟล์
        if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
            logging.error("Audio file is missing or empty")
            return jsonify({'error': 'Audio file is missing or empty'}), 400
        
        # แปลงไฟล์เสียงเป็น features
        audio_features = preprocess_audio(temp_path)
        
        # ทำนายสำเนียง
        logging.info("Predicting accent...")
        predictions = model.predict(audio_features)
        logging.info(f"Raw prediction: {predictions}")
        
        # เรียงลำดับผลลัพธ์จากมากไปน้อย
        sorted_indices = np.argsort(predictions[0])[::-1]
        
        # สร้าง results dictionary โดยเรียงตามความมั่นใจจากมากไปน้อย
        results = []
        for i in sorted_indices:
            results.append({
                'accent': class_names[i],
                'confidence': float(predictions[0][i] * 100)
            })
        
        logging.info(f"Top predictions: {results[:3]}")
        
        # ลบไฟล์ชั่วคราว
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return render_template('result.html', results=results)
        
    except Exception as e:
        logging.error(f"Error during processing: {str(e)}", exc_info=True)
        # ในกรณีที่มีข้อผิดพลาด
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': str(e)})
    
    return redirect(url_for('index'))

@app.route('/upload_recorded', methods=['POST'])
def upload_recorded():
    """
    รับไฟล์เสียงที่บันทึกจาก JavaScript
    """
    logging.info("Received recorded audio submission")
    logging.debug(f"Form data keys: {list(request.form.keys())}")
    logging.debug(f"Files data keys: {list(request.files.keys())}")
    
    temp_path = os.path.join(TEMP_AUDIO_DIR, "recorded_audio.wav")
    
    try:
        if 'audio_data' in request.files:
            # รับไฟล์จาก FormData
            audio_file = request.files['audio_data']
            audio_file.save(temp_path)
            logging.info(f"Recorded audio saved as file from files: {temp_path}")
            
        elif 'audio_data' in request.form:
            # รับข้อมูล base64 จากฟอร์ม
            audio_data_base64 = request.form['audio_data']
            logging.debug(f"Received base64 data of length: {len(audio_data_base64)}")
            
            # แยกส่วน header ของ data URL
            if 'base64,' in audio_data_base64:
                audio_data_base64 = audio_data_base64.split('base64,')[1]
                logging.debug("Base64 data extracted from data URL")
            
            try:
                # แปลง base64 เป็นไบนารี
                audio_binary = base64.b64decode(audio_data_base64)
                logging.debug(f"Decoded binary data of length: {len(audio_binary)}")
                
                with open(temp_path, 'wb') as f:
                    f.write(audio_binary)
                logging.info(f"Recorded audio (base64) saved as file: {temp_path}")
            except Exception as e:
                logging.error(f"Error decoding base64: {str(e)}", exc_info=True)
                return jsonify({'error': f'Error decoding audio data: {str(e)}'}), 400
        else:
            logging.warning("No audio data received in request")
            return jsonify({'error': 'No audio data received'}), 400
        
        # ตรวจสอบไฟล์เสียง
        if not os.path.exists(temp_path):
            logging.error("Audio file is missing after saving")
            return jsonify({'error': 'Audio file is missing after saving'}), 400
            
        file_size = os.path.getsize(temp_path)
        logging.info(f"Saved audio file size: {file_size} bytes")
        
        if file_size == 0:
            logging.error("Audio file is empty")
            return jsonify({'error': 'Audio file is empty'}), 400
            
        # แปลงไฟล์เสียงเป็น features
        try:
            audio_features = preprocess_audio(temp_path)
        except Exception as e:
            logging.error(f"Error preprocessing audio: {str(e)}", exc_info=True)
            return jsonify({'error': f'Error processing audio: {str(e)}'}), 500
        
        # ทำนายสำเนียง
        logging.info("Predicting accent...")
        predictions = model.predict(audio_features)
        
        # เรียงลำดับผลลัพธ์จากมากไปน้อย
        sorted_indices = np.argsort(predictions[0])[::-1]
        
        # สร้าง results dictionary โดยเรียงตามความมั่นใจจากมากไปน้อย
        results = []
        for i in sorted_indices:
            results.append({
                'accent': class_names[i],
                'confidence': float(predictions[0][i] * 100)
            })
        
        logging.info(f"Top predictions: {results[:3]}")
        
        # ลบไฟล์ชั่วคราว
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return render_template('result.html', results=results)
        
    except Exception as e:
        logging.error(f"Error processing recorded audio: {str(e)}", exc_info=True)
        # ในกรณีที่มีข้อผิดพลาด
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': str(e)}), 500

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

if __name__ == "__main__":
    try:
        # ทดสอบว่า librosa และ soundfile ทำงานได้หรือไม่
        import soundfile as sf
        logging.info("soundfile library available")
    except ImportError:
        logging.warning("soundfile library not available, audio conversion may not work")
        logging.warning("Try installing with: pip install soundfile")
    
    # สร้างโฟลเดอร์ templates ถ้ายังไม่มี
    templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    os.makedirs(templates_dir, exist_ok=True)
    
    # สร้างโฟลเดอร์ static/js ถ้ายังไม่มี
    static_js_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'js')
    os.makedirs(static_js_dir, exist_ok=True)
    
    logging.info(f"Server starting... templates dir: {templates_dir}, static dir: {app.static_folder}")
    app.run(debug=True)