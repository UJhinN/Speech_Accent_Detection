// Polyfill สำหรับ AudioContext และ getUserMedia
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
const errorMessage = document.getElementById('errorMessage');
const recordStatus = document.querySelector('.record-status');
const recordTimer = document.getElementById('recordTimer');

// Variables for recording
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let isRecording = false;
let stream = null;
let recordingTimeout = null;
let recordingInterval = null;
let recordingSeconds = 0;
let isProcessing = false; // ป้องกันการกดปุ่มซ้ำในขณะที่กำลังประมวลผล

// Maximum recording time in seconds
const MAX_RECORDING_TIME = 8;

// แสดงข้อความ console เพื่อทดสอบว่า JavaScript ทำงาน
console.log("recorder.js ถูกโหลดแล้ว!");

// เพิ่ม event listener เมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM โหลดเรียบร้อยแล้ว");
    console.log("micButton:", micButton);
    
    if (micButton) {
        console.log("micButton พร้อมใช้งาน");
        
        // ใช้ addEventListener อย่างเดียว
        micButton.addEventListener('click', function(event) {
            console.log("คลิกปุ่มไมโครโฟน");
            if (!isProcessing) {
                toggleRecording();
            } else {
                console.log("กำลังประมวลผล กรุณารอสักครู่...");
            }
        });
    } else {
        console.error("ไม่พบปุ่ม micButton!");
    }
});

// Function to toggle recording state
async function toggleRecording() {
    console.log("toggleRecording เริ่มทำงาน, isRecording:", isRecording);
    
    try {
        isProcessing = true; // ตั้งค่า flag ว่ากำลังประมวลผล
        
        if (!isRecording) {
            console.log("เริ่มต้นการบันทึก...");
            await startRecording();
        } else {
            console.log("หยุดการบันทึก...");
            stopRecording();
        }
    } catch (error) {
        console.error("Error in toggleRecording:", error);
        showError("เกิดข้อผิดพลาดในการควบคุมการบันทึก");
    } finally {
        isProcessing = false; // คืนค่า flag เมื่อเสร็จสิ้น
    }
}

// Function to update timer display
function updateTimerDisplay() {
    recordingSeconds++;
    const minutes = Math.floor(recordingSeconds / 60);
    const seconds = recordingSeconds % 60;
    recordTimer.textContent = 
        (minutes < 10 ? '0' : '') + minutes + ':' + 
        (seconds < 10 ? '0' : '') + seconds;
}

// Function to start timer
function startTimer() {
    recordingSeconds = 0;
    recordTimer.textContent = '00:00';
    recordTimer.classList.add('active');
    recordingInterval = setInterval(updateTimerDisplay, 1000);
}

// Function to stop timer
function stopTimer() {
    clearInterval(recordingInterval);
    recordingInterval = null;
}

// Function to show error message
function showError(message) {
    console.error("Error:", message);
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

// Start recording
async function startRecording() {
    try {
        console.log("startRecording เริ่มทำงาน");
        
        // ตรวจสอบว่าไม่ได้กำลังบันทึกอยู่แล้ว
        if (isRecording) {
            console.log("กำลังบันทึกอยู่แล้ว ไม่สามารถเริ่มบันทึกซ้ำได้");
            return;
        }
        
        // Reset audio chunks
        audioChunks = [];
        
        // Hide player and form if they were shown from previous recording
        if (audioPlayer) audioPlayer.style.display = 'none';
        if (uploadForm) uploadForm.style.display = 'none';
        
        // Request microphone access
        console.log("กำลังขอสิทธิ์เข้าถึงไมโครโฟน...");
        
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,  // mono
                    sampleRate: 44100 // standard sample rate
                } 
            });
            console.log("ได้รับอนุญาตให้ใช้ไมโครโฟนแล้ว");
        } catch (micError) {
            console.error("Error accessing microphone:", micError);
            
            if (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError') {
                showError("ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน โปรดอนุญาตการเข้าถึงไมโครโฟนในการตั้งค่าบราวเซอร์");
            } else {
                showError("ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาตรวจสอบอุปกรณ์และการตั้งค่า");
            }
            return;
        }
        
        // Create MediaRecorder with options that support MP3 or fallbacks
        let options = {};
        
        // Try to use compressed audio formats
        if (MediaRecorder.isTypeSupported('audio/mp4') || MediaRecorder.isTypeSupported('audio/mpeg')) {
            options = { mimeType: 'audio/mp4' };
            console.log("Using audio/mp4 MIME type (MP3 compatible)");
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = { mimeType: 'audio/webm;codecs=opus' };
            console.log("Using audio/webm with opus codec");
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
            console.log("Using audio/webm MIME type");
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            options = { mimeType: 'audio/ogg' };
            console.log("Using audio/ogg MIME type");
        }
        
        try {
            mediaRecorder = new MediaRecorder(stream, options);
            console.log("MediaRecorder สร้างเรียบร้อยแล้วด้วย MIME type:", options.mimeType || "default");
        } catch (e) {
            console.warn("Specified MIME type not supported, falling back to default");
            mediaRecorder = new MediaRecorder(stream);
        }
        
        // Event handler when data is available
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
                console.log(`เพิ่ม audio chunk: ${event.data.size} bytes`);
            }
        };
        
        // Event handler when recording stops
        mediaRecorder.onstop = async () => {
            console.log("MediaRecorder stopped");
            
            try {
                // Clear any timeout
                if (recordingTimeout) {
                    clearTimeout(recordingTimeout);
                    recordingTimeout = null;
                }
                
                // Stop timer
                stopTimer();
                
                // สร้าง audio blob โดยตรง
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                audioBlob = new Blob(audioChunks, { type: mimeType });
                console.log(`สร้าง audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
                
                if (audioBlob.size < 1000) {
                    showError("การบันทึกเสียงสั้นเกินไป กรุณาพูดให้ยาวขึ้น");
                    resetRecordingState();
                    return;
                }
                
                // สร้าง URL สำหรับเล่นเสียง
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // แสดง audio player
                if (audioPlayer) {
                    audioPlayer.src = audioUrl;
                    audioPlayer.style.display = 'block';
                }
                
                // แสดงฟอร์มสำหรับวิเคราะห์
                if (uploadForm) {
                    uploadForm.style.display = 'block';
                }
                
                // อัพเดทสถานะ
                if (recordStatus) {
                    recordStatus.textContent = 'บันทึกเสร็จสิ้น';
                }
                
                if (recordInstruction) {
                    recordInstruction.textContent = 'พร้อมวิเคราะห์';
                }
            } catch (error) {
                console.error("Error processing recorded audio:", error);
                showError("เกิดข้อผิดพลาดในการประมวลผลเสียงที่บันทึก กรุณาลองใหม่อีกครั้ง");
                resetRecordingState();
            }
        };
        
        // Set automatic stop after MAX_RECORDING_TIME seconds
        recordingTimeout = setTimeout(() => {
            if (isRecording) {
                console.log(`หยุดการบันทึกอัตโนมัติหลังจาก ${MAX_RECORDING_TIME} วินาที`);
                stopRecording();
            }
        }, MAX_RECORDING_TIME * 1000);
        
        // Start timer
        startTimer();
        
        // Start recording with a 100ms timeslice to get data frequently
        mediaRecorder.start(100);
        console.log("เริ่มบันทึกเสียงแล้ว");
        
        // Update UI to show recording state
        isRecording = true;
        
        if (micButton) micButton.classList.add('recording');
        if (recordInstruction) recordInstruction.textContent = 'แตะเพื่อหยุดการบันทึก';
        if (recordStatus) recordStatus.textContent = 'กำลังบันทึก...';
        
    } catch (error) {
        console.error('Error in startRecording:', error);
        showError("เกิดข้อผิดพลาดในการเริ่มบันทึกเสียง โปรดลองอีกครั้ง");
        resetRecordingState();
    }
}

// Stop recording
function stopRecording() {
    console.log("stopRecording เริ่มทำงาน");
    
    // ตรวจสอบว่ากำลังบันทึกอยู่จริง
    if (!isRecording) {
        console.log("ไม่ได้กำลังบันทึกอยู่ ไม่จำเป็นต้องหยุด");
        return;
    }
    
    // อัปเดตสถานะทันทีเพื่อให้ผู้ใช้รู้ว่าได้สั่งหยุดแล้ว
    isRecording = false;
    if (micButton) micButton.classList.remove('recording');
    if (recordInstruction) recordInstruction.textContent = 'กำลังประมวลผล...';
    if (recordStatus) recordStatus.textContent = 'กำลังประมวลผลเสียง...';
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        // หยุด MediaRecorder
        mediaRecorder.stop();
        console.log("หยุดการบันทึกแล้ว");
        
        // หยุดการถ่ายทอดเสียง
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        // ล้าง timeout ถ้ามี
        if (recordingTimeout) {
            clearTimeout(recordingTimeout);
            recordingTimeout = null;
        }
    }
}

// Reset recording state fully
function resetRecordingState() {
    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
        } catch (e) {
            console.warn("ไม่สามารถหยุด mediaRecorder:", e);
        }
    }
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    mediaRecorder = null;
    stream = null;
    
    if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
    }
    
    stopTimer();
    
    if (micButton) micButton.classList.remove('recording');
    if (recordInstruction) recordInstruction.textContent = 'กดเพื่อเริ่มพูด';
    if (recordStatus) recordStatus.textContent = 'เริ่มบันทึกเสียงของคุณ';
}

// Function to check if audio is too short (less than 1 second)
function isAudioTooShort(blob) {
    return blob.size < 10000; // Rough estimation based on typical compressed audio size
}

// Submit form when analyze button is clicked
// แทนที่โค้ดเดิมด้วยโค้ดนี้ (ค้นหาส่วนที่มี if (uploadForm) { ... })
if (uploadForm) {
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log("เริ่มการส่งฟอร์ม");
        
        if (!audioBlob) {
            showError('กรุณาบันทึกเสียงก่อน');
            return;
        }
        
        if (isAudioTooShort(audioBlob)) {
            showError('การบันทึกเสียงสั้นเกินไป กรุณาบันทึกเสียงใหม่โดยพูดให้ยาวขึ้น');
            return;
        }
        
        try {
            // แสดงสถานะกำลังแปลง
            if (analyzeButton) {
                analyzeButton.innerHTML = '<div class="loading-spinner"></div> กำลังแปลงไฟล์...';
                analyzeButton.disabled = true;
            }
            
            // แปลงเป็น MP3
            const mp3Blob = await convertToMp3(audioBlob);
            
            // สร้าง FormData
            const formData = new FormData();
            formData.append('audio_file', mp3Blob, 'recording.mp3');
            console.log(`เพิ่ม MP3 blob (${mp3Blob.size} bytes) ลงใน FormData แล้ว`);
            
            // แสดงสถานะกำลังวิเคราะห์
            if (analyzeButton) {
                analyzeButton.innerHTML = '<div class="loading-spinner"></div> กำลังวิเคราะห์...';
            }
            
            // ส่งไปยัง server
            console.log("ส่งคำขอไปที่ /upload");
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            console.log(`ได้รับการตอบสนอง: ${response.status} ${response.statusText}`);
            
            // If response is HTML (results page), display it
            if (response.headers.get('content-type') && response.headers.get('content-type').includes('text/html')) {
                const htmlContent = await response.text();
                console.log(`ได้รับเนื้อหา HTML ความยาว: ${htmlContent.length}`);
                document.open();
                document.write(htmlContent);
                document.close();
            } else {
                // Handle error response
                try {
                    const data = await response.json();
                    console.error("Error from server:", data);
                    showError('เกิดข้อผิดพลาด: ' + (data.error || 'ไม่ทราบสาเหตุ'));
                } catch (jsonError) {
                    console.error("Error parsing JSON response:", jsonError);
                    showError('เกิดข้อผิดพลาด: ไม่สามารถประมวลผลการตอบสนองจากเซิร์ฟเวอร์ได้');
                }
                
                // Reset button state
                if (analyzeButton) {
                    analyzeButton.textContent = 'วิเคราะห์สำเนียง';
                    analyzeButton.disabled = false;
                }
            }
        } catch (error) {
            console.error('Error submitting audio:', error);
            showError('เกิดข้อผิดพลาดในการส่งไฟล์เสียง: ' + error.message);
            
            // Reset button state
            if (analyzeButton) {
                analyzeButton.textContent = 'วิเคราะห์สำเนียง';
                analyzeButton.disabled = false;
            }
        }
    });
}

async function convertToMp3(audioBlob) {
    console.log("กำลังแปลงเสียงเป็น MP3...");
    
    // แปลงจาก blob เป็น ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext();
    
    // Decode audio
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // แปลงเป็น MP3 ด้วย lamejs
    const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
    
    // แปลงข้อมูลเสียงเป็นฟอร์แมตที่ lamejs รองรับ
    const samples = new Int16Array(audioBuffer.length);
    const left = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < audioBuffer.length; i++) {
        samples[i] = left[i] * 0x7FFF; // แปลงจาก -1.0...1.0 เป็น -32768...32767
    }
    
    // Encode MP3
    const mp3Data = [];
    const sampleBlockSize = 1152;
    
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
        const sampleChunk = samples.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }
    
    // Flush encoder
    const mp3buf = mp3Encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }
    
    // สร้าง Blob MP3
    const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
    console.log(`MP3 Blob สร้างเสร็จแล้ว: ${mp3Blob.size} bytes`);
    
    return mp3Blob;
}
// // เพิ่มฟังก์ชันนี้
// async function convertToMp3(audioBlob) {
//     console.log("กำลังแปลงเสียงเป็น MP3...");
    
//     // แปลงจาก blob เป็น ArrayBuffer
//     const arrayBuffer = await audioBlob.arrayBuffer();
//     const audioContext = new AudioContext();
    
//     // Decode audio
//     const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
//     // แปลงเป็น MP3 ด้วย lamejs
//     const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
    
//     // แปลงข้อมูลเสียงเป็นฟอร์แมตที่ lamejs รองรับ
//     const samples = new Int16Array(audioBuffer.length);
//     const left = audioBuffer.getChannelData(0);
    
//     for (let i = 0; i < audioBuffer.length; i++) {
//         samples[i] = left[i] * 0x7FFF; // แปลงจาก -1.0...1.0 เป็น -32768...32767
//     }
    
//     // Encode MP3
//     const mp3Data = [];
//     const sampleBlockSize = 1152;
    
//     for (let i = 0; i < samples.length; i += sampleBlockSize) {
//         const sampleChunk = samples.subarray(i, i + sampleBlockSize);
//         const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
//         if (mp3buf.length > 0) {
//             mp3Data.push(mp3buf);
//         }
//     }
    
//     // Flush encoder
//     const mp3buf = mp3Encoder.flush();
//     if (mp3buf.length > 0) {
//         mp3Data.push(mp3buf);
//     }
    
//     // สร้าง Blob MP3
//     const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
//     console.log(`MP3 Blob สร้างเสร็จแล้ว: ${mp3Blob.size} bytes`);
    
//     return mp3Blob;
// }

// Handle file upload form
const audioFileInput = document.getElementById('audioFile');
const fileName = document.getElementById('fileName');
const fileUploadForm = document.getElementById('fileUploadForm');
const uploadButton = document.getElementById('uploadButton');

if (audioFileInput) {
    audioFileInput.addEventListener('change', function() {
        if (fileName) {
            fileName.textContent = this.files[0] ? this.files[0].name : 'ยังไม่ได้เลือกไฟล์';
        }
    });
}

if (fileUploadForm) {
    fileUploadForm.addEventListener('submit', function(e) {
        const fileInput = document.getElementById('audioFile');
        if (!fileInput || fileInput.files.length === 0) {
            e.preventDefault();
            showError('กรุณาเลือกไฟล์เสียงก่อน');
            return;
        }
        
        if (uploadButton) {
            uploadButton.innerHTML = '<div class="loading-spinner"></div> กำลังอัปโหลด...';
            uploadButton.disabled = true;
        }
    });
}

// ทดสอบเมื่อโหลดหน้าเสร็จ
console.log("recorder.js โหลดเสร็จสมบูรณ์แล้ว");