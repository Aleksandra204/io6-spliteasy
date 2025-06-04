document.addEventListener("DOMContentLoaded", () => {
  const confirmBtn = document.getElementById("confirm-settle");
  const cancelBtn = document.getElementById("cancel-settle");
  const list = document.getElementById("debtor-list");

  fetch("/balance-users", { credentials: "include" })
    .then(res => res.json())
    .then(users => {
      users
        .filter(user => user.balance > 0)
        .forEach(user => {
          const item = document.createElement("li");
          item.classList.add("debtor-item");
          item.innerHTML = `
            <label>
              <input type="checkbox" data-userid="${user.id}" data-amount="${user.balance.toFixed(2)}" />
              <span>${user.name}</span>
              <span>${user.balance.toFixed(2)} zł</span>
            </label>`;
          list.appendChild(item);
        });
    });

  cancelBtn.addEventListener("click", () => {
    window.location.href = "groups.html";
  });

  confirmBtn.addEventListener("click", async () => {
    const selected = document.querySelectorAll('.debtor-item input:checked');

    for (const input of selected) {
      const toUserId = input.dataset.userid;
      const amount = parseFloat(input.dataset.amount);

      await fetch("/transaction", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, amount })
      });
    }

    alert("Rozliczono!");
    window.location.href = "groups.html";
  });
});
