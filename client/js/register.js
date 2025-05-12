

async function register(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const { name, mail, password, confirmPassword } = Object.fromEntries(formData);
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = "";
  errorDiv.style.display = "none";


  if (password !== confirmPassword) {
    errorDiv.textContent = "Hasła się nie zgadzają.";
      errorDiv.style.display = "block";
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
});
