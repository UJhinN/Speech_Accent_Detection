// Polyfill สำหรับ AudioContext และ getUserMedia ถ้าจำเป็น
window.AudioContext = window.AudioContext || window.webkitAudioContext;
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || 
                        navigator.mozGetUserMedia || navigator.msGetUserMedia;

// DOM elements
const micButton = document.getElementById('micButton');
const recordInstruction = document.getElementById('recordInstruction');
const audioPlayer = document.getElementById('audioPlayer');
const uploadForm = document.getElementById('uploadForm');
const analyzeButton = document.getElementById('analyzeButton');
const audioData = document.getElementById('audioData');

// ตัวแปรสำหรับการบันทึก
let mediaRecorder;
let audioChunks = [];
let audioBlob;
let isRecording = false;
let stream;

// เริ่มหรือหยุดการบันทึกเมื่อคลิกปุ่มไมค์
micButton.addEventListener('click', toggleRecording);

// ฟังก์ชันสำหรับสลับสถานะการบันทึก
async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

// ฟังก์ชันสำหรับแปลงไฟล์เสียงเป็น WAV ที่สมบูรณ์
function ensureWavFormat(audioBlob) {
    return new Promise((resolve) => {
        // สร้าง AudioContext
        const audioContext = new AudioContext();
        
        // แปลง Blob เป็น ArrayBuffer
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const arrayBuffer = this.result;
            
            // Decode เสียงจาก ArrayBuffer
            audioContext.decodeAudioData(arrayBuffer, function(audioBuffer) {
                // สร้าง Offline AudioContext เพื่อ render เสียงใหม่
                const offlineAudioContext = new OfflineAudioContext(
                    audioBuffer.numberOfChannels,
                    audioBuffer.length,
                    audioBuffer.sampleRate
                );
                
                // สร้าง source node
                const source = offlineAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineAudioContext.destination);
                source.start(0);
                
                // Render เสียงเป็น AudioBuffer
                offlineAudioContext.startRendering().then(function(renderedBuffer) {
                    // แปลง AudioBuffer เป็น WAV format
                    const wavBlob = bufferToWav(renderedBuffer);
                    console.log(`Generated WAV file: ${wavBlob.size} bytes`);
                    resolve(wavBlob);
                });
            });
        };
        
        fileReader.readAsArrayBuffer(audioBlob);
    });
}

// ฟังก์ชันสำหรับแปลง AudioBuffer เป็น WAV Blob
function bufferToWav(buffer) {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    
    // จำนวน bytes ที่ต้องการ
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const dataSize = length * blockAlign;
    const fileSize = 44 + dataSize; // 44 bytes for WAV header
    
    // สร้าง ArrayBuffer สำหรับ WAV file
    const arrayBuffer = new ArrayBuffer(fileSize);
    const view = new DataView(arrayBuffer);
    
    // เขียน WAV header
    // "RIFF" chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk length
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 8 * bytesPerSample, true); // bits per sample
    
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // เขียนข้อมูลเสียง
    const offset = 44;
    let index = 0;
    
    // ถ้าเป็น mono
    if (numberOfChannels === 1) {
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++, index += 2) {
            const sample = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset + index, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        }
    } 
    // ถ้าเป็น stereo
    else if (numberOfChannels === 2) {
        const dataL = buffer.getChannelData(0);
        const dataR = buffer.getChannelData(1);
        for (let i = 0; i < length; i++) {
            // ช่องซ้าย
            const sampleL = Math.max(-1, Math.min(1, dataL[i]));
            view.setInt16(offset + index, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7FFF, true);
            index += 2;
            
            // ช่องขวา
            const sampleR = Math.max(-1, Math.min(1, dataR[i]));
            view.setInt16(offset + index, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7FFF, true);
            index += 2;
        }
    }
    
    return new Blob([view], { type: 'audio/wav' });
}

// ฟังก์ชันช่วยสำหรับเขียน string ใน DataView
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// เริ่มการบันทึก
async function startRecording() {
    try {
        // รีเซ็ต audio chunks
        audioChunks = [];
        
        // ขอการเข้าถึงไมโครโฟน
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,  // mono
                sampleRate: 44100 // standard sample rate
            } 
        });
        console.log("Microphone access granted");
        
        // สร้าง MediaRecorder ใหม่
        const options = { mimeType: 'audio/webm' };
        try {
            mediaRecorder = new MediaRecorder(stream, options);
            console.log("Using audio/webm MIME type");
        } catch (e) {
            console.warn("audio/webm not supported, falling back to default");
            mediaRecorder = new MediaRecorder(stream);
        }
        
        // Event handler เมื่อมีข้อมูลพร้อมใช้งาน
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
                console.log(`Audio chunk added: ${event.data.size} bytes`);
            }
        };
        
        // Event handler เมื่อการบันทึกหยุด
        mediaRecorder.onstop = async () => {
            try {
                // สร้าง audio blob จาก chunks
                const rawBlob = new Blob(audioChunks, { type: 'audio/webm' });
                console.log(`Created raw audio blob: ${rawBlob.size} bytes, type: ${rawBlob.type}`);
                
                // แปลงเป็น WAV format ที่สมบูรณ์
                audioBlob = await ensureWavFormat(rawBlob);
                console.log(`Converted to WAV blob: ${audioBlob.size} bytes`);
                
                // สร้าง URL สำหรับ audio blob
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // ตั้งค่า audio player source และแสดง
                audioPlayer.src = audioUrl;
                audioPlayer.style.display = 'block';
                
                // แสดงปุ่มวิเคราะห์
                analyzeButton.style.display = 'block';
                
                // แปลง audio blob เป็น base64 สำหรับการส่งฟอร์ม
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = function() {
                    const base64data = reader.result;
                    audioData.value = base64data;
                    console.log(`Converted to base64: ${base64data.substring(0, 50)}...`);
                    
                    // แสดงฟอร์ม
                    uploadForm.style.display = 'block';
                };
            } catch (error) {
                console.error("Error processing recorded audio:", error);
                alert("Error processing recording. Please try again.");
            }
        };
        
        // เริ่มการบันทึก
        mediaRecorder.start();
        console.log("Recording started");
        
        // อัปเดต UI เพื่อแสดงสถานะการบันทึก
        isRecording = true;
        micButton.classList.add('recording');
        recordInstruction.textContent = 'Recording... Tap to stop';
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Error accessing microphone. Please make sure your browser has permission to use the microphone.');
    }
}

// หยุดการบันทึก
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        // หยุด MediaRecorder
        mediaRecorder.stop();
        console.log("Recording stopped");
        
        // หยุดทุก tracks ในสตรีม
        stream.getTracks().forEach(track => track.stop());
        
        // อัปเดต UI เพื่อแสดงสถานะที่หยุด
        isRecording = false;
        micButton.classList.remove('recording');
        recordInstruction.textContent = 'Recording complete';
    }
}

// ส่งฟอร์มเมื่อคลิกปุ่มวิเคราะห์
uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    console.log("Form submission started");
    
    if (!audioBlob) {
        alert('Please record audio first.');
        return;
    }
    
    // สร้าง FormData object สำหรับการอัปโหลด
    const formData = new FormData();
    
    // แนบไฟล์เสียงโดยตรง
    formData.append('audio_data', audioBlob, 'recording.wav');
    console.log("Added audio blob to FormData");
    
    try {
        // แสดงสถานะกำลังโหลด
        analyzeButton.textContent = 'Analyzing...';
        analyzeButton.disabled = true;
        
        console.log("Sending request to /upload_recorded");
        // ส่งเสียงที่บันทึกไปยังเซิร์ฟเวอร์
        const response = await fetch('/upload_recorded', {
            method: 'POST',
            body: formData
        });
        
        console.log(`Response received: ${response.status} ${response.statusText}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        
        // ถ้าการตอบสนองเป็น HTML (หน้าผลลัพธ์) ให้แสดง
        if (response.headers.get('content-type') && response.headers.get('content-type').includes('text/html')) {
            const htmlContent = await response.text();
            console.log(`Received HTML content length: ${htmlContent.length}`);
            document.open();
            document.write(htmlContent);
            document.close();
        } else {
            // จัดการกับการตอบสนองที่เป็นข้อผิดพลาด
            try {
                const data = await response.json();
                console.error("Error from server:", data);
                alert('Error: ' + (data.error || 'Unknown error'));
            } catch (jsonError) {
                console.error("Error parsing JSON response:", jsonError);
                alert('Error: Could not process server response');
            }
            
            // รีเซ็ตสถานะปุ่ม
            analyzeButton.textContent = 'Analyze Accent';
            analyzeButton.disabled = false;
        }
    } catch (error) {
        console.error('Error submitting audio:', error);
        alert('Error submitting audio. Please try again.');
        
        // รีเซ็ตสถานะปุ่ม
        analyzeButton.textContent = 'Analyze Accent';
        analyzeButton.disabled = false;
    }
});