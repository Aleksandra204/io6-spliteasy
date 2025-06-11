window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/groups", {
      method: "GET",
      credentials: "include",
    });

    if (res.status === 401 || res.status === 403) {
      alert("Musisz się zalogować, aby korzystać z tej strony.");
      window.location.href = "login.html";
    }
  } catch (err) {
    console.error("Błąd autoryzacji:", err);
    alert("Błąd autoryzacji – spróbuj ponownie.");
    window.location.href = "login.html";
  }
});
