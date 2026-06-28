# dmu_Graduation_project
5조 앱 개발

## 앱: IT 전공생들을 위한 AI 기반 취업 지원 서류 서비스 앱

### 개발자:  마인혁, 이소윤, 김동혁, 이현승

- 목적: IT 전공생의 GitHub와 프로젝트 데이터를 정밀 분석하여 기술 역량을 객관적으로 지표화하고, 이를 바탕으로 개인별 맞춤형 기술을 지원하여 IT 전공생들이 채용 시장에서 차별화된 경쟁력을 갖추도록 하는 데 목적이 있습니다.

- 용도 : 사용자의 역량에 최적화된 자격증 및 심화 학습 콘텐츠를 추천하는 가이드로 활용될 뿐만 아니라, AI를 통해 기술 중심의 자기소개서와 포트폴리오를 생성하고 기술 면접 예상 질문을 도출함으로써 서류 준비부터 실무 면접까지 전 과정을 통합 관리하는 전문 취업 지원 도구입니다.

### 전체 프로젝트 구조

```text
dmu_Graduation_project/
├── .github/              # GitHub 협업 설정 (Issue 템플릿 등)
├── .gitignore            # 전체 무시 파일 설정 (루트 레벨)
├── README.md             # 전체 프로젝트 설명
├── backend/              # [백엔드 작업 공간]
│   ├── app/              # 실제 FastAPI 코드
│   │   ├── main.py       # FastAPI 진입점
│   │   ├── routers/      # API 라우팅 (기능별 파일 분리)
│   │   └── database.py   # DB 연결 설정
│   ├── .env              # 비밀 키 (GitHub 업로드 금지!)
│   └── requirements.txt  # 파이썬 의존성 목록
└── frontend/             # [프론트엔드 작업 공간]
    ├── src/              # React Native 소스
    ├── assets/           # 이미지, 아이콘
    ├── package.json      # npm 의존성 목록
    └── README.md         # 프론트엔드 전용 문서

```   
### 🚀 협업 가이드 (Git Flow)
우리 프로젝트는 안전한 협업을 위해 다음 규칙을 준수합니다.

#### 1. 브랜치 전략
- `main`: 최종 배포용 브랜치 (절대 직접 수정 금지)
- `(상위 폴더)/기능명`: 각자 기능을 개발하는 브랜치 (예: `routers/login`)

#### 2. 작업 프로세스
1. `git checkout main` (main 브랜치로 이동)
2. `git pull origin main` (최신 코드 가져오기)
3. `git checkout -b (상위 폴더)/기능명` (새로운 기능 브랜치 생성 및 이동) 
- 만약 처음 브랜치를 만든 거면 (git push --set-upstream origin (상위 폴더)/기능명)
4. 코드 작성 및 커밋
5. `git push origin (상위 폴더)/기능명`
6. GitHub 저장소 접속 → Compare & pull request 버튼 클릭 → 변경 사항 설명 작성 후 Create pull request!

### 3. 백엔드 PYTHON 버전 및 설치
- 3.12
1. Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process (터미널에 쉽게 venv 가능하게 해줌)
2. py -3.12 -m venv venv
3. .\venv\Scripts\Activate.ps1
4. pip install -r "dmu_Graduation_project\backend\requirements.txt"

### 4. 프론트엔트 앱 가동
- npm install
#### 로컬 서버 가동하기
- npm run dev
