from flask import Flask, request, jsonify, render_template
import tensorflow as tf
import librosa
import numpy as np
import os

app = Flask(__name__)

# โหลดโมเดล
MODEL_PATH = 'D:\\Y2.2\\Speech_Accent_Detection\\Model\\cnn_tunning.h5'
model = tf.keras.models.load_model(MODEL_PATH)

# รายชื่อ accents ที่โมเดลทำนายได้
class_names = [
    "Arabic", "Dutch", "English", "French", "German",
    "Italian", "Korean", "Mandarin", "Polish", "Portuguese",
    "Russian", "Spanish", "Turkish"
]

def preprocess_audio(file_path, target_sample_rate=44100, n_mfcc=13):
    # โหลดไฟล์เสียง
    y, sr = librosa.load(file_path, sr=target_sample_rate)
    
    # สกัด MFCC
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
    
    # Normalize
    mfcc = (mfcc - np.mean(mfcc)) / np.std(mfcc)
    mfcc = mfcc.T
    
    # ปรับขนาด
    if mfcc.shape[0] > 13:
        mfcc = mfcc[:13, :]
    else:
        mfcc = np.pad(mfcc, ((0, 13 - mfcc.shape[0]), (0, 0)), mode='constant')
    mfcc = np.mean(mfcc, axis=1, keepdims=True)
    
    # เพิ่มมิติให้ตรงกับ input ของโมเดล
    mfcc = np.expand_dims(mfcc, axis=0)
    
    return mfcc

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    if not file.filename.endswith(('.mp3', '.wav')):
        return jsonify({'error': 'Invalid file format. Please upload MP3 or WAV file'}), 400
    
    # บันทึกไฟล์ชั่วคราว
    temp_path = 'temp_audio.mp3'
    file.save(temp_path)
    
    try:
        # Preprocess
        audio_data = preprocess_audio(temp_path)
        
        # ทำนาย
        predictions = model.predict(audio_data)
        predicted_class = np.argmax(predictions, axis=1)[0]
        
        # ความน่าจะเป็นของแต่ละ class
        probabilities = predictions[0].tolist()
        
        result = {
            'predicted_accent': class_names[predicted_class],
            'confidence': float(predictions[0][predicted_class]),
            'all_probabilities': dict(zip(class_names, probabilities))
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
    finally:
        # ลบไฟล์ชั่วคราว
        if os.path.exists(temp_path):
            os.remove(temp_path)

# HTML Template
@app.route('/templates/index.html')
def serve_template():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Accent Classifier</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            .container {
                text-align: center;
            }
            .result {
                margin-top: 20px;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Accent Classifier</h1>
            <form id="uploadForm">
                <input type="file" id="audioFile" accept=".mp3,.wav" required>
                <button type="submit">Analyze Accent</button>
            </form>
            <div id="result" class="result" style="display: none;">
                <h2>Results:</h2>
                <p>Predicted Accent: <span id="accent"></span></p>
                <p>Confidence: <span id="confidence"></span>%</p>
                <div id="allProbabilities"></div>
            </div>
        </div>

        <script>
            document.getElementById('uploadForm').onsubmit = function(e) {
                e.preventDefault();
                
                const formData = new FormData();
                const fileField = document.getElementById('audioFile');
                
                formData.append('file', fileField.files[0]);
                
                fetch('/predict', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                        return;
                    }
                    
                    document.getElementById('result').style.display = 'block';
                    document.getElementById('accent').textContent = data.predicted_accent;
                    document.getElementById('confidence').textContent = 
                        (data.confidence * 100).toFixed(2);
                    
                    // แสดงความน่าจะเป็นทั้งหมด
                    const probDiv = document.getElementById('allProbabilities');
                    probDiv.innerHTML = '<h3>All Probabilities:</h3>';
                    
                    Object.entries(data.all_probabilities)
                        .sort((a, b) => b[1] - a[1])
                        .forEach(([accent, prob]) => {
                            probDiv.innerHTML += `${accent}: ${(prob * 100).toFixed(2)}%<br>`;
                        });
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('An error occurred while processing the audio file.');
                });
            };
        </script>
    </body>
    </html>
    """

if __name__ == '__main__':
    app.run(debug=True)