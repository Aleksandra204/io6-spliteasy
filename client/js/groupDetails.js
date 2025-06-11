window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get('id');

  if (!groupId) {
    alert('Brak ID grupy');
    window.location.href = 'groups.html';
    return;
  }

  try {
    const [detailsRes, balanceRes, billsRes] = await Promise.all([
      fetch(`/group/${groupId}/details`, {credentials: 'include'}),
      fetch(`/group/${groupId}/balance`, {credentials: 'include'}),
      fetch(`/group/${groupId}/bills`, {credentials: 'include'}),
    ]);

    if (!detailsRes.ok || !balanceRes.ok || !billsRes.ok) {
      throw new Error('Błąd ładowania danych');
    }

    const groupDetails = await detailsRes.json();
    const balance = await balanceRes.json();
    const bills = await billsRes.json();

    document.querySelector('.group-details__title').textContent =
        groupDetails.name;

    document.querySelector('.card--total-expenses .card__value').textContent =
        `${Number(balance.total_group_spending).toFixed(2)} zł`;
    document.querySelector('.card--your-debt .card__value').textContent =
        `${Number(balance.you_owe_now).toFixed(2)} zł`;
    document.querySelector('.card--others-owe .card__value').textContent =
        `${Number(balance.others_owe_you).toFixed(2)} zł`;

    const userId = await getLoggedInUserId();
    const membersList = document.querySelector('.members__list');
    membersList.innerHTML = '';

    groupDetails.members.forEach(member => {
      const li = document.createElement('li');
      li.className = 'members__item';

      const name = member.id === userId ? `${member.name} (Ja)` : member.name;

      li.innerHTML = `
        <img src="assets/person_icon.svg" alt="" class="members__icon">
        <div class="members__info">
          <span class="members__name">${name}</span>
        </div>
      `;

      membersList.appendChild(li);
    });

    document.querySelector('.members__count').textContent =
        groupDetails.members.length;

    const tbody = document.querySelector('.expenses__table tbody');
    tbody.innerHTML = '';

    bills.forEach(bill => {
      const row = document.createElement('tr');
      const yourBalance =
          bill.your_share - (bill.total / groupDetails.members.length);

      row.innerHTML = `
        <td>${bill.description}</td>
        <td>${bill.payer}</td>
        <td>${new Date(bill.date).toLocaleDateString('pl-PL')}</td>
        <td>${Number(bill.total).toFixed(2)} zł</td>
        <td class="${yourBalance < 0 ? 'negative' : 'positive'}">
          ${yourBalance >= 0 ? '+' : '−'}${
          Math.abs(yourBalance).toFixed(2)} zł
        </td>
        <td class="expenses__icons">
          <button class="icon-button icon-button--info">i</button>
          <button class="icon-button icon-button--delete">🗑</button>
        </td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error('Błąd wczytywania szczegółów grupy:', err);
    alert('Wystąpił błąd podczas ładowania danych grupy.');
  }

  async function getLoggedInUserId() {
    const res = await fetch('/user/me', {credentials: 'include'});
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  }
});

document.getElementById('add-expense-btn')?.addEventListener('click', () => {
  const modal = document.getElementById('create-expense-modal');
  const overlay = document.getElementById('modal-overlay');
  modal?.classList.remove('hidden');
  overlay?.classList.remove('hidden');
});

document.querySelectorAll('.modal__close').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const modal = e.target.closest('.modal');
    modal?.classList.add('hidden');

    const overlay = document.getElementById('modal-overlay');
    overlay?.classList.add('hidden');
  });
});

document.getElementById('modal-overlay')?.addEventListener('click', () => {
  document.querySelectorAll('.modal').forEach(
      modal => modal.classList.add('hidden'));
  document.getElementById('modal-overlay')?.classList.add('hidden');
});
