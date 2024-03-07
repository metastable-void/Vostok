
let signedInUser = null; // screen_name
let signedInPassword = null;

const displayError = (e) => {
  const strError = String(e);
  const error = document.getElementById('error');
  error.textContent = strError;
};

const checkPassword = async (screen_name, password) => {
  const queryParams = new URLSearchParams({ screen_name, password });
  const response = await fetch(`/api/check-password?${queryParams}`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error('Error checking password');
  }
  const result = await response.json();
  return result;
};

const createUser = async (screen_name, password) => {
  const queryParams = new URLSearchParams({ screen_name, password });
  const response = await fetch(`/api/create-or-update-user?${queryParams}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Error creating user');
  }
  const result = await response.json();
  return result;
};

const signInOrSignUp = async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const checkPasswordResult = await checkPassword(username, password);
  if (checkPasswordResult.error) {
    const createUserResult = await createUser(username, password);
    if (createUserResult.error) {
      throw new Error(createUserResult.error);
    }
  } else {
    console.log('User exists');
    if (!checkPasswordResult.result) {
      throw new Error('Incorrect password');
    }
    signedInUser = username;
    signedInPassword = password;
  }
};

document.getElementById('sign-in').addEventListener('click', () => {
  try {
    signInOrSignUp();
    document.getElementById('password').value = '';
    document.getElementById('signed-out').hidden = true;
    document.getElementById('signed-in').hidden = false;
  } catch (e) {
    console.error(e);
    displayError(e);
    document.getElementById('password').value = '';
  }
});

document.getElementById('sign-out').addEventListener('click', () => {
  signedInUser = null;
  signedInPassword = null;
  document.getElementById('signed-in').hidden = true;
  document.getElementById('signed-out').hidden = false;
});
