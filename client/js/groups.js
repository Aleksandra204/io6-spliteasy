window.addEventListener('DOMContentLoaded', async () => {
  const openModalBtn = document.querySelector('.groups__container .button');
  const modal = document.getElementById('create-group-modal');
  const overlay = document.getElementById('modal-overlay');
  const closeModalBtn = modal?.querySelector('.modal__close');

  const overlay2 = document.getElementById('modal-overlay-2');
  const modal2 = document.getElementById('modal-add-members');
  const closeModalBtn2 = modal2?.querySelector('.modal__close');

  const openAddMemberBtn = document.querySelector('.member--add');

  function openModal(modalEl, overlayEl) {
    modalEl?.classList.remove('hidden');
    overlayEl?.classList.remove('hidden');
  }

  function closeModal(modalEl, overlayEl) {
    modalEl?.classList.add('hidden');
    overlayEl?.classList.add('hidden');
  }

  openModalBtn?.addEventListener('click', () => openModal(modal, overlay));
  closeModalBtn?.addEventListener('click', () => closeModal(modal, overlay));
  overlay?.addEventListener('click', () => closeModal(modal, overlay));
  closeModalBtn2?.addEventListener('click', () => closeModal(modal2, overlay2));
  overlay2?.addEventListener('click', () => closeModal(modal2, overlay2));

  openAddMemberBtn?.addEventListener(
      'click', () => openModal(modal2, overlay2));

  const container = document.querySelector('.groups__cards');
  if (container) {
    try {
      const res = await fetch('/groups', {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Brak dostępu');

      const groups = await res.json();

      if (groups.length === 0) {
        container.innerHTML = '<p>Nie masz jeszcze żadnych grup.</p>';
        return;
      }

      groups.forEach((group) => {
        if (!group.name?.trim()) return;

        const card = document.createElement('div');
        card.className = 'group-card';

        card.innerHTML = `
          <img src="assets/group_icon.svg" alt="" class="group-card__icon" />
          <div class="group-card__text">
            <h3>${group.name}</h3>
            <p>STAN: NIEZNANY</p>
          </div>
        `;

        card.addEventListener('click', () => {
          window.location.href = `groupDetails.html?id=${group.id}`;
        });

        container.appendChild(card);
      });
    } catch (err) {
      console.error('Błąd ładowania grup:', err);
      container.innerHTML = '<p>Błąd podczas ładowania grup.</p>';
    }
  }

  let memberEmails = [];

  document.getElementById('add-member-btn')?.addEventListener('click', () => {
    const emailInput = document.getElementById('member-email');
    const email = emailInput.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Podaj poprawny email.');
      return;
    }

    if (memberEmails.includes(email)) {
      alert('Użytkownik już dodany.');
      return;
    }

    memberEmails.push(email);

    const list = document.getElementById('member-list');

    const memberDiv = document.createElement('div');
    memberDiv.className = 'member';

    const icon = document.createElement('img');
    icon.src = memberEmails.length % 2 === 0 ? 'assets/member_even.svg' :
                                               'assets/member_odd.svg';
    icon.alt = 'Członek grupy';
    icon.className = 'member__icon';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'member__name';
    nameSpan.textContent = email;

    memberDiv.appendChild(icon);
    memberDiv.appendChild(nameSpan);
    list.appendChild(memberDiv);

    memberDiv.addEventListener('click', () => {
      memberDiv.remove();
      memberEmails = memberEmails.filter(e => e !== email);
    });

    emailInput.value = '';

    modal2?.classList.add('hidden');
    overlay2?.classList.add('hidden');
  });


  document.getElementById('create-group-btn')
      ?.addEventListener('click', async () => {
        const name = document.getElementById('group-name').value.trim();
        if (!name) return alert('Podaj nazwę grupy');

        try {
          const resolvedUsers = [];

          for (const mail of memberEmails) {
            const res = await fetch(`/user/${mail}`, {
              method: 'GET',
              credentials: 'include',
            });

            if (!res.ok) {
              alert(`Nie znaleziono użytkownika: ${mail}`);
              return;
            }

            const data = await res.json();
            resolvedUsers.push(data.id);
          }

          const response = await fetch('/group', {
            method: 'POST',
            credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              name,
              userIds: resolvedUsers,
            }),
          });

          const result = await response.json();

          if (response.ok) {
            alert('Grupa utworzona!');
            memberEmails = [];
            document.getElementById('group-name').value = '';
            document.getElementById('member-list').innerHTML = '';
            modal?.classList.add('hidden');
            overlay?.classList.add('hidden');
            window.location.reload();
          } else {
            alert('Błąd tworzenia: ' + result.msg);
          }
        } catch (err) {
          console.error(err);
          alert('Nie udało się utworzyć grupy.');
        }
      });
});