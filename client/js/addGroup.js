
const addPersonPopup = document.getElementById('addPersonPopup');
const emailInput = document.getElementById('emailInput');
const errorMessage = document.getElementById('errorMessage');

let invitedUsers = []; // Lista użytkowników zaproszonych {id, name}

function openAddPerson() {
  errorMessage.textContent = '';
  emailInput.value = '';
  addPersonPopup.classList.remove('hidden');
}

function closeAddPerson() {
  addPersonPopup.classList.add('hidden');
}

function closeModal() {
  window.location.href = "groups.html";
}



async function confirmAddPerson() {
  const email = emailInput.value.trim();

  if (!email) {
    errorMessage.textContent = "Podaj adres email.";
    return;
  }

  try {
    const response = await fetch(`/user/${encodeURIComponent(email)}`);
    
    if (!response.ok) {
      throw new Error("Nie znaleziono użytkownika.");
    }

    const user = await response.json(); // { id, name }


    if (invitedUsers.some(u => u.id === user.id)) {
      errorMessage.textContent = "Użytkownik już został dodany.";
      return;
    }

    invitedUsers.push(user);
    addUserToUI(user);
    closeAddPerson();

  } catch (error) {
    errorMessage.textContent = error.message || "Błąd podczas wyszukiwania użytkownika.";
  }
}

// Dodanie użytkownika  do listy 
function addUserToUI(user) {
  const membersDiv = document.querySelector('.members');
  const addBtn = document.querySelector('.member.add');

  const newMember = document.createElement('div');
  newMember.className = 'member';
  newMember.innerHTML = `
    <img src="assets/userIcon.png" alt="Użytkownik">
    <p>${user.name}</p>
  `;

  membersDiv.insertBefore(newMember, addBtn);
}

// Utworzenie grupy po kliknięciu "Utwórz"
async function createGroup() {
  const groupName = document.getElementById('groupName').value.trim();

  if (!groupName) {
    alert("Podaj nazwę grupy.");
    return;
  }

  if (invitedUsers.length === 0) {
    alert("Dodaj przynajmniej jedną osobę do grupy.");
    return;
  }

  const groupData = {
    name: groupName,
    userIds: invitedUsers.map(user => user.id)
  };

  try {
    const response = await fetch('/group', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(groupData)
    });

    if (!response.ok) {
      throw new Error("Nie udało się utworzyć grupy.");
    }

    alert("Grupa została utworzona!");

} catch (error) {
    alert(error.message);
  }
}
