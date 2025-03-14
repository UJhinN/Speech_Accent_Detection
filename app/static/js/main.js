document.addEventListener('DOMContentLoaded', function() {
    console.log("JavaScript เริ่มทำงาน");
    
    // ===============================
    // เพิ่ม Animation พื้นหลัง
    // ===============================
    
    // สร้างองค์ประกอบพื้นหลัง
    const bgAnimation = document.createElement('div');
    bgAnimation.className = 'bg-animation';
    document.body.insertBefore(bgAnimation, document.body.firstChild);
    
    // สร้าง gradient เคลื่อนไหวได้
    const bgGradient = document.createElement('div');
    bgGradient.className = 'bg-gradient';
    bgAnimation.appendChild(bgGradient);
    
    // สร้างคลื่นเสียงในพื้นหลัง
    createAudioWaves(bgAnimation);
    
    // สร้าง particles
    createParticles(bgAnimation);
    
    // ============================
    // ฟังก์ชัน Animation พื้นหลัง
    // ============================
    
    // ฟังก์ชันสร้างคลื่นเสียง
    function createAudioWaves(container) {
        const wavesContainer = document.createElement('div');
        wavesContainer.className = 'waves-container';
        
        // สร้างแต่ละ wave
        for (let i = 0; i < 30; i++) {
            const wave = document.createElement('div');
            wave.className = 'wave-bar';
            
            // สุ่มความสูงและดีเลย์แอนิเมชัน
            const height = Math.random() * 50 + 10;
            const delay = Math.random() * 1;
            const duration = Math.random() * 0.8 + 0.6;
            
            wave.style.height = `${height}px`;
            wave.style.animationDelay = `${delay}s`;
            wave.style.animationDuration = `${duration}s`;
            
            wavesContainer.appendChild(wave);
        }
        
        container.appendChild(wavesContainer);
    }
    // ฟังก์ชันสร้าง particles
    function createParticles(container) {
        const particleCount = window.innerWidth < 768 ? 15 : 25; // น้อยลงบนมือถือ
        
        for (let i = 0; i < particleCount; i++) {
            setTimeout(() => {
                createParticle(container);
            }, i * 200);
        }
        
        // สร้าง particles ใหม่ทุก 2 วินาที
        setInterval(() => {
            createParticle(container);
        }, 2000);
    }
    
    function createParticle(container) {
        const particle = document.createElement('div');
        particle.className = 'animated-particle';
        
        // สุ่มขนาดและตำแหน่ง
        const size = Math.random() * 6 + 2;
        const left = Math.random() * 100;
        const duration = Math.random() * 15 + 10;
        const delay = Math.random() * 5;
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${left}%`;
        particle.style.bottom = '0';
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;
        particle.style.opacity = `${Math.random() * 0.3}`;
        
        container.appendChild(particle);
        
        // ลบ particle หลังจากจบ animation
        setTimeout(() => {
            if (container.contains(particle)) {
                container.removeChild(particle);
            }
        }, (duration + delay) * 1000);
    }
    
    // เพิ่ม Effects สำหรับหน้าผลลัพธ์
    const isResultPage = document.querySelector('.top-prediction') !== null;
    if (isResultPage) {
        setTimeout(() => {
            addResultPageEffects();
        }, 1000);
    }
    
    function addResultPageEffects() {
        // สร้าง confetti เมื่อแสดงผลลัพธ์
        const celebrationContainer = document.createElement('div');
        celebrationContainer.className = 'accent-celebration';
        document.body.appendChild(celebrationContainer);
        
        // สร้าง confetti
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                
                const size = Math.random() * 15 + 5;
                const left = Math.random() * 100;
                const duration = Math.random() * 3 + 2;
                const color = getRandomColor();
                
                confetti.style.width = `${size}px`;
                confetti.style.height = `${size}px`;
                confetti.style.left = `${left}%`;
                confetti.style.backgroundColor = color;
                confetti.style.animationDuration = `${duration}s`;
                
                celebrationContainer.appendChild(confetti);
                
                setTimeout(() => {
                    if (celebrationContainer.contains(confetti)) {
                        celebrationContainer.removeChild(confetti);
                    }
                }, duration * 1000);
            }, i * 50);
        }
        
        celebrationContainer.classList.add('show');
        
        // สร้าง Highlight effect รอบกล่องผลลัพธ์แรก
        const topPrediction = document.querySelector('.top-prediction');
        if (topPrediction) {
            const glowEffect = document.createElement('div');
            glowEffect.className = 'result-glow-effect';
            topPrediction.appendChild(glowEffect);
        }
        
        setTimeout(() => {
            document.body.removeChild(celebrationContainer);
        }, 4000);
    }
    
    function getRandomColor() {
        const colors = [
            '#ff5252', '#ff7575', '#ff9e9e', 
            '#ffeb3b', '#ffc107', '#ff9800',
            '#8bc34a', '#4caf50', '#009688'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    // Responsive canvas wave (ทำงานเฉพาะเมื่อ user กำลังบันทึกเสียง)
    const recordButton = document.querySelector('#recordButton');
    let audioContext;
    let analyser;
    let waveCanvas;
    let canvasContext;
    let animationFrame;
    let dataArray;
    
    function setupAudioVisualizer() {
        // สร้าง canvas สำหรับแสดงคลื่นเสียง
        if (!document.getElementById('waveformCanvas')) {
            waveCanvas = document.createElement('canvas');
            waveCanvas.id = 'waveformCanvas';
            waveCanvas.className = 'waveform-canvas';
            waveCanvas.width = 300;
            waveCanvas.height = 50;
            
            // เพิ่ม canvas หลังปุ่มบันทึก
            const recordSection = document.querySelector('.record-section');
            if (recordSection) {
                recordSection.insertBefore(waveCanvas, document.getElementById('recordedAudio'));
            }
            
            canvasContext = waveCanvas.getContext('2d');
        }
    }
    
    function startAudioVisualization(stream) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        // แสดง canvas
        if (waveCanvas) {
            waveCanvas.style.display = 'block';
            drawWaveform();
        }
    }
    
    function drawWaveform() {
        // ยกเลิก animation frame ก่อนหน้า
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        
        const draw = function() {
            animationFrame = requestAnimationFrame(draw);
            
            if (!analyser) return;
            
            analyser.getByteFrequencyData(dataArray);
            
            canvasContext.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
            
            const barWidth = (waveCanvas.width / dataArray.length) * 2.5;
            let x = 0;
            
            for (let i = 0; i < dataArray.length; i++) {
                const barHeight = (dataArray[i] / 255) * waveCanvas.height;
                
                // ไล่สีจากโทนสีหลัก
                const r = 255;
                const g = 82 + (dataArray[i] / 2);
                const b = 82;
                
                canvasContext.fillStyle = `rgb(${r}, ${g}, ${b})`;
                canvasContext.fillRect(x, (waveCanvas.height - barHeight) / 2, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }
    
    function stopAudioVisualization() {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        
        if (waveCanvas) {
            waveCanvas.style.display = 'none';
        }
    }
    // ===============================
    // โค้ดเดิมจาก main.js (ปรับแต่งบางส่วน)
    // ===============================
    
    // เลือกองค์ประกอบสำหรับการบันทึกเสียง
    const recordingStatus = document.querySelector('#recordingStatus');
    const recordingTimer = document.querySelector('#recordingTimer');
    const recordInstruction = document.querySelector('#recordInstruction');
    const recordedAudio = document.querySelector('#recordedAudio');
    
    // เลือกปุ่มวิเคราะห์ใหม่
    const analyzeButton = document.querySelector('#analyzeButton');
    
    // เลือกองค์ประกอบสำหรับการอัปโหลด
    const uploadArea = document.querySelector('#uploadArea');
    const fileUpload = document.querySelector('#fileUpload');
    const fileName = document.querySelector('#fileName');
    const uploadPreview = document.querySelector('#uploadPreview');
    const uploadedAudio = document.querySelector('#uploadedAudio');
    const analyzeUpload = document.querySelector('#analyzeUpload');
    const cancelUpload = document.querySelector('#cancelUpload');
    
    // เลือกองค์ประกอบสำหรับตัวอย่างเสียง
    const analyzeSampleButtons = document.querySelectorAll('.analyze-sample');
    
    // เลือกองค์ประกอบสำหรับหน้าโหลด
    const globalLoader = document.querySelector('#globalLoader');
    
    // ตัวแปรสำหรับการบันทึกเสียง
    let mediaRecorder;
    let audioChunks = [];
    let recordingStartTime;
    let timerInterval;
    let recordedBlob;
    
    // ตัวแปรสำหรับการอัปโหลด
    let uploadedFile;
    // ฟังก์ชัน Drag and Drop สำหรับอัปโหลด
    if (uploadArea) {
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', function() {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                handleUploadedFile(e.dataTransfer.files[0]);
            }
        });
    }
    
    // กำหนดการทำงานของปุ่มบันทึกเสียง
    if (recordButton) {
        // เพิ่ม Ripple effect เมื่อ hover
        recordButton.addEventListener('mouseenter', function() {
            this.classList.add('btn-hover');
        });
        
        recordButton.addEventListener('mouseleave', function() {
            this.classList.remove('btn-hover');
        });
        
        recordButton.addEventListener('click', function() {
            console.log("คลิกปุ่มบันทึกเสียง");
            
            // สร้าง ripple effect
            createRippleEffect(this);
            
            if (!navigator.mediaDevices) {
                alert("เบราว์เซอร์ของคุณไม่รองรับการบันทึกเสียง");
                return;
            }
            
            // เริ่มหรือหยุดการบันทึกเสียง
            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                startRecording();
            } else {
                stopRecording();
            }
        });
    } else {
        console.error("ไม่พบปุ่มบันทึกเสียง - ตรวจสอบ ID: recordButton");
    }
    
    // สร้าง ripple effect เมื่อคลิกปุ่ม
    function createRippleEffect(button) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${0}px`;
        ripple.style.top = `${0}px`;
        
        button.appendChild(ripple);
        
        setTimeout(() => {
            button.removeChild(ripple);
        }, 800);
    }
    // กำหนดการทำงานของปุ่มวิเคราะห์สำเนียง
    if (analyzeButton) {
        analyzeButton.addEventListener('click', function() {
            console.log("คลิกปุ่มวิเคราะห์สำเนียง");
            
            if (!recordedBlob) {
                alert('โปรดบันทึกเสียงก่อนวิเคราะห์');
                return;
            }
            
            // เพิ่ม pulse animation ก่อนแสดง overlay
            this.classList.add('button-pulse');
            
            setTimeout(() => {
                this.classList.remove('button-pulse');
                showLoadingOverlay();
                submitRecordedAudio();
            }, 400);
        });
    }
    
    // กำหนดการทำงานเมื่อมีการเลือกไฟล์
    if (fileUpload) {
        fileUpload.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                handleUploadedFile(e.target.files[0]);
            }
        });
    }
    
    // กำหนดการทำงานของปุ่มวิเคราะห์ไฟล์อัปโหลด
    if (analyzeUpload) {
        analyzeUpload.addEventListener('click', function() {
            if (!uploadedFile) {
                alert('โปรดเลือกไฟล์ก่อนวิเคราะห์');
                return;
            }
            
            showLoadingOverlay();
            submitUploadedFile();
        });
    }
    
    // กำหนดการทำงานของปุ่มยกเลิกการอัปโหลด
    if (cancelUpload) {
        cancelUpload.addEventListener('click', function() {
            resetUploadUI();
        });
    }
    
    // เพิ่มเหตุการณ์สำหรับปุ่มวิเคราะห์ตัวอย่างเสียง
    if (analyzeSampleButtons) {
        analyzeSampleButtons.forEach(button => {
            button.addEventListener('click', function() {
                console.log("คลิกปุ่มวิเคราะห์ตัวอย่างเสียง");
                
                const sampleFile = this.getAttribute('data-sample');
                if (sampleFile) {
                    console.log("กำลังเตรียมวิเคราะห์ตัวอย่างเสียง:", sampleFile);
                    showLoadingOverlay();
                    
                    // ไปยังหน้าตัวอย่างเสียงที่จะ redirect ไปยังหน้าผลลัพธ์
                    window.location.href = `/samples/${sampleFile}`;
                }
            });
        });
    }
    // ฟังก์ชันเริ่มบันทึกเสียง
    async function startRecording() {
        try {
            console.log("กำลังเริ่มบันทึกเสียง...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            
            // สร้าง visualizer สำหรับแสดงคลื่นเสียง
            setupAudioVisualizer();
            startAudioVisualization(stream);
            
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.addEventListener('dataavailable', function(e) {
                audioChunks.push(e.data);
            });
            
            mediaRecorder.addEventListener('stop', function() {
                console.log("หยุดบันทึกเสียงแล้ว");
                recordedBlob = new Blob(audioChunks, { type: 'audio/mp3' });
                
                // หยุด audio visualizer
                stopAudioVisualization();
                
                if (recordedAudio) {
                    recordedAudio.src = URL.createObjectURL(recordedBlob);
                    recordedAudio.style.display = 'block';
                }
                
                // หยุดและซ่อนนาฬิกาจับเวลา
                clearInterval(timerInterval);
                if (recordingTimer) {
                    recordingTimer.classList.remove('active');
                }
                
                // ปรับสถานะปุ่มบันทึก
                if (recordButton) {
                    recordButton.classList.remove('recording');
                }
                if (recordingStatus) {
                    recordingStatus.textContent = 'บันทึกเสียงเสร็จสิ้น';
                }
                if (recordInstruction) {
                    recordInstruction.textContent = 'กดปุ่มวิเคราะห์สำเนียงด้านล่าง';
                }
                
                // เปิดใช้งานปุ่มวิเคราะห์พร้อม animation
                if (analyzeButton) {
                    analyzeButton.disabled = false;
                    analyzeButton.classList.add('button-appear');
                    setTimeout(() => {
                        analyzeButton.classList.remove('button-appear');
                    }, 500);
                }
            });
            
            mediaRecorder.start();
            
            // อัปเดต UI
            if (recordButton) {
                recordButton.classList.add('recording');
            }
            if (recordingStatus) {
                recordingStatus.textContent = 'กำลังบันทึกเสียง...';
            }
            if (recordInstruction) {
                recordInstruction.textContent = 'กดอีกครั้งเพื่อหยุดบันทึก';
            }
            
            // ปิดการใช้งานปุ่มวิเคราะห์
            if (analyzeButton) {
                analyzeButton.disabled = true;
            }
            
            // เริ่มจับเวลา
            recordingStartTime = Date.now();
            if (recordingTimer) {
                recordingTimer.classList.add('active');
                recordingTimer.textContent = '00:00';
            }
            
            timerInterval = setInterval(updateTimer, 1000);
            
        } catch (err) {
            console.error('ข้อผิดพลาดในการเข้าถึงไมโครโฟน:', err);
            alert('ไม่สามารถเข้าถึงไมโครโฟนได้ โปรดตรวจสอบการอนุญาตใช้งานไมโครโฟนของเบราว์เซอร์');
        }
    }
    
    // ฟังก์ชันหยุดบันทึกเสียง
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            
            // หยุดทุก track เสียง
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
    
    // ฟังก์ชันอัปเดตเวลา
    function updateTimer() {
        if (!recordingTimer) return;
        
        const elapsedTime = Date.now() - recordingStartTime;
        const seconds = Math.floor((elapsedTime / 1000) % 60).toString().padStart(2, '0');
        const minutes = Math.floor((elapsedTime / 1000 / 60) % 60).toString().padStart(2, '0');
        
        recordingTimer.textContent = `${minutes}:${seconds}`;
        
        // หยุดอัตโนมัติหลังจาก 30 วินาที
        if (elapsedTime >= 30000) {
            stopRecording();
        }
    }
    // ฟังก์ชันจัดการไฟล์ที่อัปโหลด
    function handleUploadedFile(file) {
        console.log("กำลังจัดการไฟล์ที่อัปโหลด:", file.name, file.type);
        uploadedFile = file;
        
        // ตรวจสอบประเภทไฟล์
        const fileType = file.type;
        if (!fileType.startsWith('audio/')) {
            alert('โปรดเลือกไฟล์เสียงเท่านั้น (MP3, WAV, M4A)');
            resetUploadUI();
            return;
        }
        
        // แสดงชื่อไฟล์
        if (fileName) {
            fileName.textContent = file.name;
        }
        
        // แสดงตัวอย่างเสียง
        if (uploadedAudio) {
            uploadedAudio.src = URL.createObjectURL(file);
        }
        
        // แสดงส่วนตัวอย่าง ซ่อนส่วนอัปโหลด
        if (uploadPreview) {
            uploadPreview.style.display = 'block';
        }
    }
    
    // ฟังก์ชันรีเซ็ต UI การอัปโหลด
    function resetUploadUI() {
        if (uploadPreview) {
            uploadPreview.style.display = 'none';
        }
        
        if (uploadedAudio && uploadedAudio.src) {
            URL.revokeObjectURL(uploadedAudio.src);
            uploadedAudio.src = '';
        }
        
        uploadedFile = null;
        
        // รีเซ็ต input file และชื่อไฟล์
        if (fileUpload) {
            fileUpload.value = '';
        }
        if (fileName) {
            fileName.textContent = '';
        }
    }
    
    // ฟังก์ชันรีเซ็ต UI การบันทึก
    function resetRecordingUI() {
        if (recordingStatus) {
            recordingStatus.textContent = 'เริ่มบันทึกเสียงของคุณ';
        }
        if (recordingTimer) {
            recordingTimer.classList.remove('active');
        }
        if (recordButton) {
            recordButton.classList.remove('recording');
        }
        if (recordInstruction) {
            recordInstruction.textContent = 'กดเพื่อเริ่มพูด';
        }
        
        if (recordedAudio) {
            if (recordedAudio.src) {
                URL.revokeObjectURL(recordedAudio.src);
            }
            recordedAudio.src = '';
            recordedAudio.style.display = 'none';
        }
        
        // ปิดใช้งานปุ่มวิเคราะห์
        if (analyzeButton) {
            analyzeButton.disabled = true;
        }
        
        recordedBlob = null;
    }
    
    // ฟังก์ชันส่งเสียงที่บันทึกไปวิเคราะห์
    function submitRecordedAudio() {
        if (!recordedBlob) {
            alert('โปรดบันทึกเสียงก่อนวิเคราะห์');
            return;
        }
        
        console.log("กำลังส่งเสียงที่บันทึกไปวิเคราะห์...");
        
        // สร้าง FormData
        const formData = new FormData();
        formData.append('file', recordedBlob, 'recording.mp3');
        
        // ใช้ fetch API
        fetch('/record', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            // จัดการ redirect โดยตรงจาก JS
            window.location.href = response.url;
        })
        .catch(error => {
            console.error('Error sending recording:', error);
            hideLoadingOverlay();
            alert('เกิดข้อผิดพลาดในการส่งเสียงที่บันทึก โปรดลองอีกครั้ง');
        });
    }
    
    // ฟังก์ชันส่งไฟล์ที่อัปโหลดไปวิเคราะห์
    function submitUploadedFile() {
        if (!uploadedFile) {
            alert('โปรดเลือกไฟล์ก่อนวิเคราะห์');
            return;
        }
        
        console.log("กำลังส่งไฟล์ที่อัปโหลดไปวิเคราะห์...");
        
        // สร้าง FormData
        const formData = new FormData();
        formData.append('file', uploadedFile);
        
        // ใช้ fetch API
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            // จัดการ redirect โดยตรงจาก JS
            window.location.href = response.url;
        })
        .catch(error => {
            console.error('Error sending uploaded file:', error);
            hideLoadingOverlay();
            alert('เกิดข้อผิดพลาดในการส่งไฟล์ โปรดลองอีกครั้ง');
        });
    }
    // แสดงหน้าจอโหลดพร้อม animation เพิ่มเติม
    function showLoadingOverlay() {
        console.log("แสดงหน้าจอโหลด");
        if (globalLoader) {
            globalLoader.style.display = 'flex';
            
            // เพิ่ม animation อัพเดทล่าสุด
            if (!document.querySelector('.audio-waves-loader')) {
                const wavesLoader = document.createElement('div');
                wavesLoader.className = 'audio-waves-loader';
                
                for (let i = 0; i < 5; i++) {
                    const bar = document.createElement('div');
                    bar.className = 'audio-wave-bar';
                    wavesLoader.appendChild(bar);
                }
                
                // เพิ่มภายในโหลดเดอร์
                const loaderContent = globalLoader.querySelector('.loader-content');
                if (loaderContent) {
                    loaderContent.appendChild(wavesLoader);
                } else {
                    globalLoader.appendChild(wavesLoader);
                }
            }
        }
    }
    
    // ซ่อนหน้าจอโหลด
    function hideLoadingOverlay() {
        console.log("ซ่อนหน้าจอโหลด");
        if (globalLoader) {
            globalLoader.style.display = 'none';
        }
    }

    // ป้องกันการเปิดไฟล์เมื่อลากไฟล์มาในหน้า
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
    });
    
    // แสดงข้อความการเริ่มต้น
    console.log("JavaScript โหลดเสร็จสมบูรณ์ พร้อมใช้งานแล้ว");
});
