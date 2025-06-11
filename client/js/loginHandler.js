window.addEventListener('DOMContentLoaded', () => {
  fetch('/user/me', {credentials: 'include'})
      .then(res => {
        const navLinks = document.querySelector('.nav-links');
        const loginItem = navLinks?.querySelector('a[href="login.html"]');

        if (res.ok) {
          if (loginItem) {
            loginItem.textContent = 'WYLOGUJ';
            loginItem.href = '#';
            loginItem.addEventListener('click', () => {
              document.cookie = 'jwtToken=; Max-Age=0; path=/; SameSite=Lax';
              window.location.href = 'home.html';
            });
          }
        } else {
          if (loginItem) {
            loginItem.textContent = 'ZALOGUJ';
            loginItem.href = 'login.html';
          }
        }
      })
      .catch(err => {
        console.error('Błąd sprawdzania logowania:', err);
      });
});