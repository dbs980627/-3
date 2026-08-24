"""
api/recommend.py
-----------------
Vercel Serverless Function (Python).
프론트에서 POST /api/recommend 로 재료 목록을 보내면,
Google Gemini API를 호출해 레시피(JSON)를 생성한 뒤 그대로 반환한다.

요청 형식 (JSON)
{
  "ingredients": "계란, 대파, 김치, 밥",
  "mealType": "간단하고 빠르게"   # 선택값
}

성공 응답 (200)
{
  "ok": true,
  "recipe": {
    "title": "...",
    "time": "12분",
    "servings": "1인분",
    "used_ingredients": ["..."],
    "missing_ingredients": ["..."],
    "steps": ["..."],
    "tip": "..."
  }
}

실패 응답 예시
- 400: 입력값 누락(빈 재료)
- 502: Gemini API 오류(4xx/5xx) 또는 응답 형식 이상
- 504: Gemini API 응답 지연(타임아웃)
- 500: 서버 설정 오류(API 키 누락 등)
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re

import requests

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)
REQUEST_TIMEOUT_SECONDS = 55  # vercel.json 의 maxDuration(60초, Hobby 플랜 최대치)보다 짧게 설정

RECIPE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "time": {"type": "STRING"},
        "servings": {"type": "STRING"},
        "used_ingredients": {"type": "ARRAY", "items": {"type": "STRING"}},
        "missing_ingredients": {"type": "ARRAY", "items": {"type": "STRING"}},
        "steps": {"type": "ARRAY", "items": {"type": "STRING"}},
        "tip": {"type": "STRING"},
    },
    "required": ["title", "used_ingredients", "steps"],
}


def build_prompt(ingredients: str, meal_type: str) -> str:
    return (
        "너는 자취생을 위한 한국어 레시피 도우미야. "
        "아래 냉장고 재료를 기반으로, 지금 바로 만들 수 있는 요리 하나를 추천해줘.\n\n"
        f"보유 재료: {ingredients}\n"
        f"선호 스타일: {meal_type or '상관없음'}\n\n"
        "규칙:\n"
        "1. 보유 재료를 최대한 활용하고, 소금/후추/식용유 같은 기본 조미료는 "
        "   당연히 있다고 가정해도 돼.\n"
        "2. 꼭 필요한데 없을 수도 있는 재료는 missing_ingredients 에 선택 항목으로 넣어줘.\n"
        "3. steps는 실제로 따라 할 수 있게 5~8단계로 구체적으로 작성해줘.\n"
        "4. 모든 텍스트는 한국어로 작성해줘."
    )


def call_gemini(prompt: str, api_key: str) -> dict:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RECIPE_SCHEMA,
            "temperature": 0.9,
        },
    }
    response = requests.post(
        GEMINI_URL,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    return response


def extract_recipe_json(gemini_response_json: dict) -> dict:
    text = gemini_response_json["candidates"][0]["content"]["parts"][0]["text"]
    # 혹시 모델이 코드블록(```json ... ```)으로 감싸서 줄 경우 대비
    cleaned = re.sub(r"^```json|```$", "", text.strip(), flags=re.MULTILINE).strip()
    return json.loads(cleaned)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, body: dict):
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        # 1) 요청 본문 읽기
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(length) if length > 0 else b"{}"
            body = json.loads(raw_body or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"ok": False, "error": "요청 형식이 올바르지 않습니다."})
            return

        ingredients = (body.get("ingredients") or "").strip()
        meal_type = (body.get("mealType") or "").strip()

        # 2) 실패 처리: 빈 입력(필수값 누락) — 프론트에서도 막지만 서버에서도 재검증
        if not ingredients:
            self._send_json(400, {"ok": False, "error": "재료를 1개 이상 입력해주세요."})
            return

        # 3) 서버 설정 확인
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self._send_json(
                500,
                {"ok": False, "error": "서버에 GEMINI_API_KEY가 설정되어 있지 않습니다."},
            )
            return

        prompt = build_prompt(ingredients, meal_type)

        # 4) Gemini API 호출 + 실패 처리: 오류(4xx/5xx) / 지연(타임아웃)
        try:
            response = call_gemini(prompt, api_key)
        except requests.exceptions.Timeout:
            self._send_json(
                504, {"ok": False, "error": "AI 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."}
            )
            return
        except requests.exceptions.RequestException:
            self._send_json(
                502, {"ok": False, "error": "AI 서비스에 연결하지 못했습니다. 네트워크를 확인해주세요."}
            )
            return

        if response.status_code != 200:
            self._send_json(
                502,
                {
                    "ok": False,
                    "error": f"AI API 오류가 발생했습니다. (status {response.status_code})",
                },
            )
            return

        # 5) 응답 파싱
        try:
            recipe = extract_recipe_json(response.json())
        except (KeyError, IndexError, json.JSONDecodeError):
            self._send_json(
                502, {"ok": False, "error": "AI 응답을 해석하지 못했습니다. 다시 시도해주세요."}
            )
            return

        self._send_json(200, {"ok": True, "recipe": recipe})

    def do_GET(self):
        # 헬스체크 / 브라우저에서 직접 접속했을 때 안내
        self._send_json(
            200,
            {
                "ok": True,
                "message": "이 엔드포인트는 POST 요청 전용입니다. recipe.html 화면에서 폼을 이용해주세요.",
            },
        )
