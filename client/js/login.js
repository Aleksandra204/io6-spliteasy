
const api_path = "";

async function login(e) {
  e.preventDefault(); 

  
  const formData = new FormData(e.target);
  const formProps = Object.fromEntries(formData);

  
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = ""; 

  try {
    
    const res = await fetch(`${api_path}/login`, {
      method: "POST",
      credentials: "include",               
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formProps),      
    });

    if (res.ok) {
      
      window.location.href = "/home.html";
    } else {
      
      const data = await res.json();
      errorDiv.textContent = data.msg || "Nie udało się zalogować.";
    }
  } catch (err) {
    
    console.error("Login error:", err);
    errorDiv.textContent = "Wystąpił błąd. Spróbuj ponownie później.";
  }
}


window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  if (form) {
    form.addEventListener("submit", login);
  }
});
