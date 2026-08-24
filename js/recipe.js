// recipe.js
// 역할: 사용자가 입력한 냉장고 재료를 받아 /api/recommend 로 전송(fetch)하고,
//      응답을 "영수증" 형태의 결과 카드로 화면에 그려준다.
// 실패 처리: 1) 빈 입력  2) API 오류(4xx/5xx)  3) 응답 지연(타임아웃)

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recipe-form');
  const ingredientsInput = document.getElementById('ingredients');
  const mealTypeSelect = document.getElementById('meal-type');
  const submitBtn = document.getElementById('submit-btn');
  const statusMsg = document.getElementById('status-msg');
  const resultArea = document.getElementById('result-area');
  const chipRow = document.getElementById('chip-row');

  const TIMEOUT_MS = 58000; // 58초 이상 응답이 없으면 지연으로 간주 (백엔드 55초보다 여유를 둠)

  // 자주 쓰는 재료를 클릭하면 입력창에 바로 추가되는 칩 버튼
  if (chipRow) {
    chipRow.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const word = chip.dataset.value;
        const current = ingredientsInput.value.trim();
        ingredientsInput.value = current
          ? (current.endsWith(',') ? `${current} ${word}` : `${current}, ${word}`)
          : word;
        ingredientsInput.focus();
      });
    });
  }

  function showStatus(type, message) {
    statusMsg.className = `status-msg show ${type}`;
    statusMsg.innerHTML = type === 'loading'
      ? `<span class="spinner"></span>${message}`
      : message;
  }

  function hideStatus() {
    statusMsg.className = 'status-msg';
    statusMsg.innerHTML = '';
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? '레시피 만드는 중…' : '레시피 추천받기';
  }

  function renderEmpty() {
    resultArea.innerHTML = `
      <div class="result-empty">
        <div class="icon-big">🧊</div>
        <p>왼쪽에 냉장고 속 재료를 입력하면<br>이 자리에 추천 레시피 영수증이 출력돼요.</p>
      </div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function renderRecipe(recipe) {
    const usedList = (recipe.used_ingredients || [])
      .map((i) => `<div class="receipt-row"><span>· ${escapeHtml(i)}</span></div>`)
      .join('');

    const missingList = (recipe.missing_ingredients || []).length
      ? (recipe.missing_ingredients || [])
          .map((i) => `<div class="receipt-row dim"><span>+ ${escapeHtml(i)}</span><span>선택</span></div>`)
          .join('')
      : `<div class="receipt-row dim"><span>없음 — 지금 있는 재료로 충분해요</span></div>`;

    const steps = (recipe.steps || [])
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join('');

    resultArea.innerHTML = `
      <div class="receipt">
        <div class="receipt-title">
          🧾 ${escapeHtml(recipe.title || '오늘의 냉장고 레시피')}
          <small>예상 조리시간 ${escapeHtml(recipe.time || '?')} · ${escapeHtml(recipe.servings || '1인분')}</small>
        </div>

        <div class="receipt-row" style="font-weight:600;">사용하는 재료</div>
        ${usedList || '<div class="receipt-row dim"><span>-</span></div>'}

        <div class="receipt-divider"></div>

        <div class="receipt-row" style="font-weight:600;">있으면 더 좋아요</div>
        ${missingList}

        <div class="receipt-divider"></div>

        <div class="receipt-row" style="font-weight:600; margin-bottom:6px;">조리 순서</div>
        <ol class="steps-list">${steps || '<li>조리 순서 정보 없음</li>'}</ol>

        ${recipe.tip ? `<div class="receipt-divider"></div><div class="receipt-row dim">💡 ${escapeHtml(recipe.tip)}</div>` : ''}

        <div class="receipt-barcode"></div>
      </div>`;
  }

  renderEmpty();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus();

    const ingredients = ingredientsInput.value.trim();

    // 1) 실패 처리: 빈 입력(필수값 누락)
    if (!ingredients) {
      showStatus('error', '⚠️ 재료를 1개 이상 입력해주세요. 예: 계란, 대파, 밥');
      ingredientsInput.focus();
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          mealType: mealTypeSelect ? mealTypeSelect.value : '아무거나',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      // 2) 실패 처리: API 오류 (4xx / 5xx)
      if (!response.ok || !data || !data.ok) {
        const message = (data && data.error) || `서버 오류가 발생했어요 (코드 ${response.status})`;
        showStatus('error', `⚠️ ${message} 잠시 후 다시 시도해주세요.`);
        return;
      }

      renderRecipe(data.recipe);
      hideStatus();
    } catch (err) {
      clearTimeout(timeoutId);

      // 3) 실패 처리: 지연/타임아웃
      if (err.name === 'AbortError') {
        showStatus('error', '⏱️ AI 응답이 지연되고 있어요. 네트워크 상태를 확인하고 다시 시도해주세요.');
      } else {
        showStatus('error', '⚠️ 요청 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  });
});
