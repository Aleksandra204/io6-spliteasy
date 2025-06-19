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
    currentUserId = userId; 
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

document.querySelector('#create-expense-modal .button')?.addEventListener('click', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get('id');

  const nameInput = document.getElementById('expense-name');
  const amountInput = document.getElementById('amount');
  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!name || isNaN(amount) || amount <= 0) {
    alert('Podaj poprawne dane wydatku.');
    return;
  }

  try {
    const userRes = await fetch('/user/me', { credentials: 'include' });
    const user = await userRes.json();

    const res = await fetch(`/group/${groupId}/expense`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        amount,
        paidBy: user.id,
        splitType: 'equal'
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert('Wydatek dodany!');
      window.location.reload();
    } else {
      alert('Błąd: ' + data.msg);
    }
  } catch (err) {
    console.error('Błąd przy dodawaniu wydatku:', err);
    alert('Nie udało się dodać wydatku.');
  }
});


document.getElementById('settle-expenses-btn')?.addEventListener('click', async () => {
  const overlay = document.getElementById('modal-overlay');
  const modal   = document.getElementById('settle-expenses-modal');
  overlay.classList.remove('hidden');
  modal.classList.remove('hidden');

  const urlParams = new URLSearchParams(window.location.search);
  const groupId   = urlParams.get('id');
  let list = document.getElementById('settle-list');
  list.innerHTML = '<li>Ładowanie…</li>';

  try {
    const res = await fetch(`/group/${groupId}/settlements`, { credentials: 'include' });
    if (!res.ok) throw new Error('Brak danych');
    const items = await res.json();
    list.innerHTML = '';
    items.forEach(u => {
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="assets/person_icon.svg" class="members__icon" alt="">
        <div class="members__info">
          <span class="members__name">${u.name}</span>
          <span class="members__balance">
            ${u.balance < 0
              ? `Masz oddać użytkownikowi ${u.name}:`
              : `Użytkownik ${u.name} ma Tobie oddać:`}
            <span class="balance-value ${u.balance < 0 ? 'negative' : 'positive'}">
              ${Math.abs(u.balance).toFixed(2)} zł
            </span>
          </span>
        </div>
        <input type="checkbox" class="settle__checkbox" data-user-id="${u.id}">
      `;
      list.appendChild(li);
    });
  } catch (e) {
    list.innerHTML = `<li>Błąd: ${e.message}</li>`;
  }
});

document.getElementById('settle-confirm-btn')?.addEventListener('click', async () => {
  const overlay = document.getElementById('modal-overlay');
  const modal   = document.getElementById('settle-expenses-modal');
  const urlParams = new URLSearchParams(window.location.search);
  const groupId   = urlParams.get('id');

  const checked = Array.from(
    document.querySelectorAll('#settle-list .settle__checkbox:checked')
  ).map(cb => cb.dataset.userId);

  if (checked.length === 0) {
    alert('Wybierz przynajmniej jedno saldo.');
    return;
  }

  try {
    const res = await fetch(`/group/${groupId}/settle`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: checked })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || 'Błąd serwera');
    alert('Rozliczono pomyślnie!');
    window.location.reload();
  } catch (e) {
    alert('Nie udało się rozliczyć: ' + e.message);
  }

  overlay.classList.add('hidden');
  modal.classList.add('hidden');
});

const payerSelector    = document.getElementById('expense-payer-selector');
const selectPayerModal = document.getElementById('select-payer-modal');
const payerList = selectPayerModal.querySelector('.modal__choices-list');
const payerConfirmBtn  = document.getElementById('payer-confirm-btn');
let expensePayerId     = null;
let groupMembers       = [];
let currentUserId      = null;

payerSelector.addEventListener('click', async () => {
  document.getElementById('modal-overlay').classList.remove('hidden');
  selectPayerModal.classList.remove('hidden');

  if (groupMembers.length === 0) {
    payerList.innerHTML = '<li>Ładowanie…</li>';
    try {
      const groupId = new URLSearchParams(window.location.search).get('id');
      const res     = await fetch(`/group/${groupId}/details`, { credentials: 'include' });
      const { members } = await res.json();
      groupMembers = members;
      payerList.innerHTML = '';
      members.forEach(m => {
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="assets/person_icon.svg" class="members__icon" alt="">
        <div class="members__info">
        <span class="members__name">
          ${m.name}${m.id === currentUserId ? ' (Ja)' : ''}
        </span>
        </div>
        <input type="checkbox" data-user-id="${m.id}">
      `;
      payerList.appendChild(li);
      });

    } catch (e) {
      payerList.innerHTML = `<li>Błąd: ${e.message}</li>`;
    }
  }

  payerList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });
});

payerList.addEventListener('click', e => {
  if (e.target.tagName === 'INPUT') {
    payerList.querySelectorAll('input').forEach(cb => cb.checked = false);
    e.target.checked = true;
  }
});

payerConfirmBtn.addEventListener('click', () => {
  const checked = payerList.querySelector('input:checked');
  if (!checked) {
    alert('Wybierz osobę.');
    return;
  }
  expensePayerId = checked.dataset.userId;
  payerSelector.textContent = 
    groupMembers.find(m => m.id === Number(expensePayerId)).name;
  selectPayerModal.classList.add('hidden');
  document.getElementById('modal-overlay').classList.add('hidden');
});