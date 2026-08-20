// 모든 페이지에서 공통으로 쓰는 스크립트
// 역할: 모바일 화면에서 햄버거 버튼을 누르면 메뉴를 열고 닫는다.

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
      toggleBtn.textContent = isOpen ? '✕' : '☰';
    });

    // 메뉴 항목을 누르면 자동으로 닫힘 (모바일)
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = '☰';
      });
    });
  }
});
