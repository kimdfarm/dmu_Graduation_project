import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.core.config import supabase

router = APIRouter(
    prefix="/resume",
    tags=["Resume"]
)

# 💡 사진과 파일을 업로드받아 DB에 매핑하는 API
@router.post("/upload")
async def upload_resume(
    member_id: str = Form(...),                        # 어떤 회원의 이력서인지 ID 수신
    photo: UploadFile = File(None),                    # 사진 파일 (선택)
    resume_file: UploadFile = File(...)                 # 이력서 파일 (필수)
):
    try:
        photo_url = None
        file_url = None

        # 1️⃣ 사진 업로드 처리 (사진이 들어온 경우에만)
        if photo:
            # 파일명 중복 방지를 위한 랜덤 이름 생성 (확장자 유지)
            photo_ext = photo.filename.split(".")[-1]
            photo_name = f"photos/{uuid.uuid4()}.{photo_ext}"
            photo_content = await photo.read()

            # Supabase Storage 'resumes' 버킷에 업로드
            supabase.storage.from_("resumes").upload(
                path=photo_name,
                file=photo_content,
                file_options={"content-type": photo.content_type}
            )
            # 공개 다운로드 URL 추출
            photo_url = supabase.storage.from_("resumes").get_public_url(photo_name)

        # 2️⃣ 이력서 파일 업로드 처리
        file_ext = resume_file.filename.split(".")[-1]
        file_name = f"files/{uuid.uuid4()}.{file_ext}"
        file_content = await resume_file.read()

        supabase.storage.from_("resumes").upload(
            path=file_name,
            file=file_content,
            file_options={"content-type": resume_file.content_type}
        )
        file_url = supabase.storage.from_("resumes").get_public_url(file_name)

        # 3️⃣ 우리 DB `public.resumes` 테이블에 파일 URL 정보 저장
        db_result = supabase.table("resumes").insert({
            "member_id": member_id,
            "photo_url": photo_url,
            "file_url": file_url
        }).execute()

        return {
            "status": "success",
            "message": "이력서 파일 및 사진 업로드가 완료되었습니다.",
            "data": db_result.data[0]
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"이력서 업로드 실패: {str(e)}")