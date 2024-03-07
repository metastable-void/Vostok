
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
    console.log('creating user');
    const createUserResult = await createUser(username, password);
    if (createUserResult.error) {
      throw new Error(createUserResult.error);
    }
  } else {
    console.log('User exists');
    if (!checkPasswordResult.result) {
      throw new Error('Incorrect password');
    }
  }
  signedInUser = username;
  signedInPassword = password;
  document.getElementById('signed-in-username').textContent = signedInUser;
};

const reloadMusicList = async () => {
  let files;
  let dir_name;
  try {
    const userInfoResponse = await fetch(`/api/users/${encodeURIComponent(signedInUser)}`, {
      method: 'GET',
    });
    if (!userInfoResponse.ok) {
      throw new Error('Error getting user info');
    }
    const userInfo = await userInfoResponse.json();
    if (userInfo.error) {
      throw new Error(userInfo.error);
    }
    const {data_dir_name} = userInfo.user ?? {};
    if (!data_dir_name) {
      throw new Error('No data directory found');
    }
    const filesResponse = await fetch(`/api/files/${encodeURIComponent(data_dir_name)}`, {
      method: 'GET',
    });
    if (!filesResponse.ok) {
      throw new Error('Error getting files');
    }
    const response = await filesResponse.json();
    if (response.error) {
      throw new Error(response.error);
    }
    if (!response.files) {
      throw new Error('No files found');
    }
    files = response.files;
    dir_name = data_dir_name;
  } catch (e) {
    console.error(e);
    displayError(e);
    return;
  }
  const filesList = document.getElementById('music');
  for (const file of files) {
    const fileElement = document.createElement('li');
    fileElement.textContent = file.title;
    filesList.appendChild(fileElement);
    fileElement.addEventListener('click', async () => {
      [... filesList.children].forEach((child) => {
        child.classList.remove('selected');
      });
      const audio = document.getElementById('audio');
      audio.src = `/files/${encodeURIComponent(dir_name)}/${encodeURIComponent(file.filename)}`;
      audio.oncanplay = () => {
        fileElement.classList.add('selected');
      };
    });
  }
};

document.getElementById('sign-in').addEventListener('click', async () => {
  try {
    await signInOrSignUp();
    document.getElementById('password').value = '';
    document.getElementById('signed-out').hidden = true;
    document.getElementById('signed-in').hidden = false;
    await reloadMusicList();
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

document.getElementById('file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    document.getElementById('file-size').textContent = '-';
    return;
  }
  document.getElementById('file-size').textContent = file.size;
});

document.getElementById('upload').addEventListener('click', async () => {
  const file = document.getElementById('file').files[0];
  if (!file) {
    displayError('No file selected');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    const queryParams = new URLSearchParams({ screen_name: signedInUser, password: signedInPassword });

    const response = await fetch(`/api/upload?${queryParams}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Error uploading file');
    }
    const result = await response.json();
    if (result.error) {
      throw new Error(result.error);
    }
    document.getElementById('file').value = '';
    document.getElementById('file-size').textContent = '-';
    reloadMusicList();
  } catch (e) {
    console.error(e);
    displayError(e);
  }
});
