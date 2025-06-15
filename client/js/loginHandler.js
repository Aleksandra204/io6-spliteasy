window.addEventListener('DOMContentLoaded', () => {
  const authLink = document.getElementById('auth-link');

  fetch('/user/me', {credentials: 'include'})
      .then(res => {
        if (!authLink) return;

        if (res.ok) {
          authLink.textContent = 'WYLOGUJ';
          authLink.href = '#';
          authLink.addEventListener('click', (e) => {
            e.preventDefault();
            fetch('/logout', {method: 'POST', credentials: 'include'})
                .then(() => {
                  window.location.href = 'home.html';
                });
          });

        } else {
          authLink.textContent = 'ZALOGUJ';
          authLink.href = 'login.html';
        }
      })
      .catch(err => {
        console.error('Błąd sprawdzania logowania:', err);
      });
});
