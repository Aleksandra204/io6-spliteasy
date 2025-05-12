

async function register(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const { name, mail, password, confirmPassword } = Object.fromEntries(formData);
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = "";

  if (password !== confirmPassword) {
    errorDiv.textContent = "Hasła się nie zgadzają.";
    return;
  }

  try {
    const res = await fetch("/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mail, password }),
    });

    const data = await res.json();
    if (res.status === 201) {
      alert(data.msg);
      window.location.href = "/login.html";
    } else {
      errorDiv.textContent = data.msg || "Błąd rejestracji.";
    }
  } catch (err) {
    console.error("Register error:", err);
    errorDiv.textContent = "Wystąpił błąd. Spróbuj później.";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  if (form) form.addEventListener("submit", register);
});
