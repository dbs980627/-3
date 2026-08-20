# 🧊 냉장고 파먹기

냉장고에 있는 재료만 입력하면 **Google Gemini AI**가 지금 바로 만들 수 있는 레시피를
"영수증" 형태로 추천해주는 웹 서비스입니다. 자취생·1인 가구가 장 보기 전에
냉장고 재료부터 소진하도록 돕는 것이 목표입니다.

- **배포 URL**: `<여기에 Vercel 배포 주소를 입력하세요>` (예: https://your-project.vercel.app)
- **GitHub 저장소**: `<여기에 저장소 주소를 입력하세요>`

---

## 1. 주요 기능

| 페이지 | 경로 | 설명 |
|---|---|---|
| 홈 | `index.html` | 서비스 소개 및 히어로 섹션, 레시피 추천 페이지로 이동 |
| AI 레시피 추천 | `recipe.html` | 재료 입력 → AI 호출 → 레시피 결과 출력 (핵심 AI 기능) |
| 서비스 소개 | `about.html` | 목적, 타겟, 기술 스택, FAQ |

상단 내비게이션 바(모바일에서는 햄버거 메뉴)로 세 페이지를 자유롭게 이동할 수 있습니다.

---

## 2. 기술 스택

- **프론트엔드**: HTML5, CSS3(반응형, Flexbox/Grid), Vanilla JavaScript (프레임워크 없음)
- **백엔드**: Python 3 기반 Vercel Serverless Function (`api/recommend.py`)
- **AI API**: Google Gemini API (`gemini-2.0-flash`, `generateContent`)
- **배포**: Vercel (GitHub 연동 자동 배포)

### 폴더 구조

```
recipe-ai/
├─ index.html          # 홈
├─ recipe.html          # AI 레시피 추천 (핵심 기능)
├─ about.html           # 서비스 소개
├─ css/
│  └─ style.css
├─ js/
│  ├─ main.js           # 공통 스크립트 (모바일 메뉴)
│  └─ recipe.js         # AI 기능 프론트 로직 (fetch, 로딩/에러 처리)
├─ api/
│  └─ recommend.py      # Gemini API를 호출하는 서버리스 함수
├─ requirements.txt     # Python 패키지 목록
├─ vercel.json          # 함수 실행시간(maxDuration) 설정
├─ .env.example          # 환경 변수 예시
└─ docs/
   └─ 기획서.md
```

---

## 3. 로컬에서 실행하기

### 3-1. 저장소 클론

```bash
git clone <저장소 주소>
cd recipe-ai
```

### 3-2. Vercel CLI로 로컬 실행 (프론트+백엔드 동시 확인)

Python 서버리스 함수(`api/`)는 정적 서버만으로는 동작하지 않으므로,
Vercel CLI를 이용해 로컬에서도 실제 배포 환경과 동일하게 실행하는 것을 권장합니다.

```bash
npm install -g vercel   # 최초 1회
vercel dev
```

실행 후 터미널에 표시되는 주소(기본 `http://localhost:3000`)로 접속하면
`index.html`, `recipe.html`, `about.html`과 `/api/recommend`가 모두 정상 동작합니다.

> 단순히 `index.html`을 브라우저로 더블클릭해서 열면 화면 확인은 가능하지만,
> `/api/recommend` 호출은 실패합니다(백엔드 서버가 없기 때문).

### 3-3. 환경 변수 설정 (로컬)

프로젝트 루트에 `.env` 파일을 만들고 아래 내용을 채워주세요. (`.env.example` 참고)

```
GEMINI_API_KEY=발급받은_API_키
GEMINI_MODEL=gemini-2.0-flash
```

`GEMINI_API_KEY`는 [Google AI Studio](https://aistudio.google.com/apikey)에서 무료로 발급받을 수 있습니다.

---

## 4. Vercel 배포 방법

1. 이 저장소를 본인 GitHub 계정으로 fork/push 합니다.
2. [vercel.com](https://vercel.com)에 로그인 후 **Add New → Project**를 선택합니다.
3. 방금 push한 GitHub 저장소를 선택해 Import 합니다.
   - Framework Preset: `Other` (정적 파일 + `api/` 폴더 자동 인식)
   - Build Command / Output Directory: 별도 설정 불필요 (정적 HTML이므로 비워둠)
4. **Environment Variables**에서 아래 값을 등록합니다.

   | Key | Value |
   |---|---|
   | `GEMINI_API_KEY` | 발급받은 Gemini API 키 |
   | `GEMINI_MODEL` | `gemini-2.0-flash` (선택, 생략 시 기본값 사용) |

5. **Deploy**를 클릭하면 빌드가 진행되고, 완료되면 `https://프로젝트명.vercel.app` 주소가 발급됩니다.
6. 배포 후 실제 주소에서 3개 페이지 이동, 모바일 화면(개발자 도구 반응형 모드 또는 실제 기기),
   AI 레시피 추천 기능이 모두 정상 동작하는지 확인합니다.
7. 코드를 수정하면 GitHub에 `git push`만 해도 Vercel이 자동으로 재배포합니다.
   - 재배포 후에도 문제가 있으면 Vercel 대시보드의 **Deployments → Logs**에서
     `api/recommend.py`의 에러 로그를 확인해 원인을 파악합니다.

---

## 5. 환경 변수 안내 (왜 필요한가요?)

Gemini API 키는 절대 프론트엔드(JavaScript) 코드에 직접 넣으면 안 됩니다.
브라우저 개발자 도구만 열어도 누구나 키를 복사해 무단으로 사용할 수 있기 때문입니다.

그래서 이 프로젝트는:
1. API 키를 **서버(Vercel Serverless Function)의 환경 변수**로만 저장하고,
2. 브라우저(JS)는 `/api/recommend`라는 우리 서버 주소만 호출하며,
3. 실제 Gemini API 호출은 서버(`api/recommend.py`) 안에서만 이루어집니다.

이렇게 하면 API 키가 클라이언트에 절대 노출되지 않습니다.

| 변수명 | 필수 여부 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | 필수 | Google AI Studio에서 발급받은 Gemini API 키 |
| `GEMINI_MODEL` | 선택 | 사용할 Gemini 모델명 (기본값: `gemini-2.0-flash`) |

---

## 6. AI 기능 실패 처리 기준

`recipe.html`에서 다음 3가지 상황을 사용자에게 안내 메시지로 알려줍니다.

1. **빈 입력**: 재료를 입력하지 않고 제출하면 "재료를 1개 이상 입력해주세요" 메시지를 표시하고 요청을 보내지 않습니다.
2. **API 오류(4xx/5xx)**: 서버(`api/recommend.py`)가 Gemini API 오류를 감지하면 상태 코드와 함께 오류 메시지를 반환하고, 화면에는 "잠시 후 다시 시도해주세요"로 안내합니다.
3. **지연/타임아웃**: 프론트에서 20초 동안 응답이 없으면 요청을 취소(AbortController)하고 "AI 응답이 지연되고 있어요" 메시지를 표시합니다.

---

## 7. 라이선스 / 제출 안내

본 프로젝트는 AI 웹 서비스 실습 과제 제출용으로 제작되었습니다.
