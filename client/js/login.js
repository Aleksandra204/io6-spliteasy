const api_path = '';

async function login(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const formProps = {
    mail: formData.get('email'),
    password: formData.get('password'),
  };

  const errorDiv = document.getElementById('error');
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';

  try {
    const res = await fetch(`${api_path}/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formProps),
    });

    if (res.ok) {
      window.location.href = 'groups.html';
    } else {
      const data = await res.json();
      errorDiv.textContent = data.msg || 'Nie udało się zalogować.';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    console.error('Login error:', err);
    errorDiv.textContent = 'Wystąpił błąd. Spróbuj ponownie później.';
    errorDiv.style.display = 'block';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', login);
  }
});

const registerBtn = document.getElementById("register-btn");
if (registerBtn) {
  registerBtn.addEventListener("click", () => {
    window.location.href = "register.html";
  });
}