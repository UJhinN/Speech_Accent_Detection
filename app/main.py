# main.py
from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
import os
import uuid
import shutil
import json
from pydub import AudioSegment
import tempfile
from pathlib import Path
from audio_processor import convert_audio_to_mp3
from model_utils import predict_accent

app = FastAPI(title="Speech Accent Detection")

# เตรียมไดเรกทอรี
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = Path(os.path.join(os.path.dirname(__file__), "uploads"))
SAMPLES_DIR = Path(os.path.join(os.path.dirname(__file__), "samples"))

# สร้างไดเรกทอรีถ้ายังไม่มี
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(SAMPLES_DIR, exist_ok=True)

# กำหนด static files และ templates
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# รายการตัวอย่างเสียง
SAMPLE_FILES = {
    "thai": "thai_sample.mp3",
    "english": "english_sample.mp3",
    "mandarin": "mandarin_sample.mp3",
    "arabic": "arabic_sample.mp3",
    "japanese": "japanese_sample.mp3",
    "hindi": "hindi_sample.mp3"
}

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """แสดงหน้าหลัก"""
    # ตรวจสอบว่ามีไฟล์ตัวอย่างหรือไม่
    samples = []
    for accent, filename in SAMPLE_FILES.items():
        file_path = SAMPLES_DIR / filename
        if file_path.exists():
            samples.append({
                "accent": accent.capitalize(),
                "filename": filename,
                "path": f"/samples/{filename}"
            })
    
    return templates.TemplateResponse(
        "index.html", 
        {"request": request, "samples": samples}
    )

@app.get("/result", response_class=HTMLResponse)
async def result_page(request: Request, error: str = None, filename: str = None, audio_path: str = None, predictions: str = None):
    """แสดงหน้าผลลัพธ์การวิเคราะห์สำเนียง"""
    
    # เพิ่ม debug log
    print(f"Received params - filename: {filename}, audio_path: {audio_path}")
    print(f"Predictions data: {predictions}")
    
    # ถ้ามี predictions ในรูปแบบ string JSON แปลงเป็น list
    prediction_data = []
    if predictions:
        try:
            import json
            prediction_data = json.loads(predictions)
            print(f"Parsed predictions: {prediction_data}")
        except Exception as e:
            print(f"ข้อผิดพลาดในการแปลง predictions: {str(e)}")
            error = "ข้อมูลผลลัพธ์ไม่ถูกต้อง"
    
    return templates.TemplateResponse(
        "result.html", 
        {
            "request": request, 
            "error": error,
            "filename": filename,
            "audio_path": audio_path,
            "predictions": prediction_data
        }
    )

@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """อัพโหลดไฟล์เสียงไปยังเซิร์ฟเวอร์"""
    try:
        # สร้างชื่อไฟล์ไม่ซ้ำกัน
        file_extension = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        # บันทึกไฟล์อัพโหลด
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"บันทึกไฟล์สำเร็จที่: {file_path}")
        
        # แปลงเป็น MP3 ถ้าจำเป็น
        if file_extension.lower() != "mp3":
            mp3_path = convert_audio_to_mp3(file_path)
            os.remove(file_path)  # ลบไฟล์ต้นฉบับ
            file_path = mp3_path
            print(f"แปลงไฟล์เป็น MP3 สำเร็จ: {mp3_path}")
        
        # ทำนายสำเนียง
        prediction_results = predict_accent(file_path)
        print(f"ผลการทำนาย: {prediction_results}")
        
        # สร้าง URL สำหรับเข้าถึงไฟล์เสียง
        file_url = f"/uploads/{file_path.name}"
        
        # สร้าง JSON string จาก prediction_results
        predictions_json = json.dumps(prediction_results)
        
        # เปลี่ยนเป็น redirect ไปยังหน้าผลลัพธ์
        return RedirectResponse(
            url=f"/result?filename={file.filename}&audio_path={file_url}&predictions={predictions_json}",
            status_code=302
        )
        
    except Exception as e:
        import traceback
        print(f"ข้อผิดพลาดในการอัพโหลด: {str(e)}")
        traceback.print_exc()
        
        # กรณีเกิดข้อผิดพลาด ให้ redirect ไปยังหน้าผลลัพธ์พร้อมข้อความข้อผิดพลาด
        return RedirectResponse(
            url=f"/result?error=เกิดข้อผิดพลาดในการวิเคราะห์: {str(e)}",
            status_code=302
        )

@app.post("/record")
async def process_recording(file: UploadFile = File(...)):
    """ประมวลผลไฟล์เสียงที่บันทึกจากไมโครโฟน"""
    try:
        print("ได้รับคำขอบันทึกเสียง")
        
        # สร้างชื่อไฟล์ไม่ซ้ำกัน
        unique_filename = f"{uuid.uuid4()}.mp3"
        file_path = UPLOAD_DIR / unique_filename
        
        print(f"กำลังบันทึกไฟล์ไปที่: {file_path}")
        
        # บันทึกไฟล์
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print("บันทึกไฟล์สำเร็จ")
        
        # ทำนายสำเนียง
        prediction_results = predict_accent(file_path)
        print(f"ผลการทำนาย: {prediction_results}")
        
        # สร้าง URL สำหรับเข้าถึงไฟล์เสียง
        file_url = f"/uploads/{unique_filename}"
        
        # สร้าง JSON string จาก prediction_results
        predictions_json = json.dumps(prediction_results)
        
        # เปลี่ยนเป็น redirect ไปยังหน้าผลลัพธ์
        return RedirectResponse(
            url=f"/result?filename=เสียงที่บันทึก&audio_path={file_url}&predictions={predictions_json}",
            status_code=302
        )
        
    except Exception as e:
        print(f"ข้อผิดพลาดในการทำนาย: {str(e)}")
        
        # กรณีเกิดข้อผิดพลาด ให้ redirect ไปยังหน้าผลลัพธ์พร้อมข้อความข้อผิดพลาด
        return RedirectResponse(
            url=f"/result?error=เกิดข้อผิดพลาดในการวิเคราะห์: {str(e)}",
            status_code=302
        )

@app.get("/samples/{filename}")
async def get_sample(filename: str):
    """ส่งไฟล์เสียงตัวอย่าง"""
    file_path = SAMPLES_DIR / filename
    
    if not file_path.exists():
        # กรณีไม่พบไฟล์ ให้ redirect ไปยังหน้าผลลัพธ์พร้อมข้อความข้อผิดพลาด
        return RedirectResponse(
            url=f"/result?error=ไม่พบไฟล์ตัวอย่าง {filename}",
            status_code=302
        )
    
    # ทำนายสำเนียง
    prediction_results = predict_accent(file_path)
    
    # สร้าง URL สำหรับเข้าถึงไฟล์เสียง
    file_url = f"/samples/{filename}"
    
    # สร้าง JSON string จาก prediction_results
    predictions_json = json.dumps(prediction_results)
    
    # เปลี่ยนเป็น redirect ไปยังหน้าผลลัพธ์
    return RedirectResponse(
        url=f"/result?filename=ตัวอย่าง {filename}&audio_path={file_url}&predictions={predictions_json}",
        status_code=302
    )

# เพิ่ม route สำหรับการเข้าถึงไฟล์ที่อัพโหลด
@app.get("/uploads/{filename}")
async def get_upload(filename: str):
    """เข้าถึงไฟล์เสียงที่อัพโหลด"""
    return FileResponse(UPLOAD_DIR / filename)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)