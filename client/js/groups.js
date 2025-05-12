const apiPath = "";

async function loadGroups() {
  try {
    const res = await fetch(`${apiPath}/groups`, {
      credentials: 'include'
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const groups = await res.json();
    renderGroups(groups);
  } catch (err) {
    console.error("Błąd ładowania grup:", err);
  }
}

function renderGroups(groups) {
  const container = document.getElementById('groups-container');
  container.innerHTML = '';

  groups.forEach(group => {
    const tile = document.createElement('div');
    tile.classList.add('group-tile');

    const icon = document.createElement('img');
    icon.src = 'assets/group-icon.svg';
    icon.alt = 'Group Icon';
    icon.classList.add('group-icon');

    const info = document.createElement('div');
    info.classList.add('group-info');

    const nameEl = document.createElement('h2');
    nameEl.classList.add('group-name');
    nameEl.textContent = group.name;

    const statusEl = document.createElement('p');
    statusEl.classList.add('group-status');
    statusEl.textContent = group.settled
      ? 'ROZLICZONO'
      : 'NIEROZLICZONO';

    info.append(nameEl, statusEl);
    tile.append(icon, info);

    tile.addEventListener('click', () => {
      window.location.href = `group.html?id=${group.id}`;
    });

    container.appendChild(tile);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  loadGroups();

  document
    .getElementById('add-group-button')
    .addEventListener('click', () => {
      window.location.href = 'create-group.html';
    });
});
