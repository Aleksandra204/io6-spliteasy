const api_path = "";

async function register(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const name = formData.get("username");
  const mail = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("password2");
  const errorDiv = document.getElementById("error");

  errorDiv.textContent = "";
  errorDiv.style.display = "none";

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(mail)) {
    errorDiv.textContent = "Podaj poprawny adres e-mail (np. a@a.a)";
    errorDiv.style.display = "block";
    return;
  }

  if (password !== confirmPassword) {
    errorDiv.textContent = "Hasła się nie zgadzają.";
    errorDiv.style.display = "block";
    return;
  }

  try {
    const res = await fetch(`${api_path}/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mail, password }),
    });

    const data = await res.json();
    if (res.status === 201 || res.ok) {
      alert(data.msg || "Rejestracja zakończona sukcesem.");
      window.location.href = "login.html";
    } else {
      errorDiv.textContent = data.msg || "Błąd rejestracji.";
      errorDiv.style.display = "block";
    }
  } catch (err) {
    console.error("Register error:", err);
    errorDiv.textContent = "Wystąpił błąd. Spróbuj później.";
    errorDiv.style.display = "block";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  if (form) form.addEventListener("submit", register);

  const goToLogin = document.getElementById("go-to-login");
  if (goToLogin) {
    goToLogin.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }
});
