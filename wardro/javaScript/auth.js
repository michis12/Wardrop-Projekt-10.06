// auth.js — simple login/register with profile image upload
(function(){
  const form = document.getElementById('authForm');
  const switchBtn = document.getElementById('switchBtn');
  const authTitle = document.getElementById('authTitle');
  const switchText = document.getElementById('switchText');
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('authMessage');
  const avatarInput = document.getElementById('avatarInput');
  const avatarPreview = document.getElementById('avatarPreview');

  let mode = 'login'; // or 'register'

  function setMessage(text, isError){
    messageEl.textContent = text;
    messageEl.style.color = isError ? '#ff8888' : '#ffffff';
  }

  // preview avatar
  // ensure avatarPreview acts as clickable trigger for file input
  function setAvatarPlaceholder(){
    avatarPreview.innerHTML = '';
    avatarPreview.style.backgroundImage = '';
    avatarPreview.classList.add('placeholder');
  }

  avatarPreview.addEventListener('click', ()=>{
    // only allow uploading when in register mode
    if (mode !== 'register') return;
    avatarInput.click();
  });

  avatarInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    avatarPreview.innerHTML = '';
    if (!file) { setAvatarPlaceholder(); return; }
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '50%';
    avatarPreview.appendChild(img);
  });

  // initialize placeholder if empty
  if (avatarPreview && avatarPreview.innerHTML.trim() === '') setAvatarPlaceholder();

  // show/hide avatar preview depending on mode
  function updateAvatarVisibility(){
    if (mode === 'register'){
      avatarPreview.style.display = 'flex';
    } else {
      avatarPreview.style.display = 'none';
    }
  }

  // ensure initial visibility
  updateAvatarVisibility();

  switchBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    if (mode === 'login'){
      mode = 'register';
      authTitle.textContent = 'Registrieren';
      submitBtn.textContent = 'Registrieren';
      switchText.textContent = 'Schon Account?';
      switchBtn.textContent = 'Login';
      // registration doesn't require both fields differently; keep same inputs
    } else {
      mode = 'login';
      authTitle.textContent = 'Login';
      submitBtn.textContent = 'Login';
      switchText.textContent = 'Noch keinen Account?';
      switchBtn.textContent = 'Registrieren';
    }
    setMessage('', false);
    // show/hide registration-specific inputs and avatar
    const regFields = document.getElementById('regFields');
    const loginIdentifier = document.getElementById('loginIdentifier');
    if (regFields && loginIdentifier){
      if (mode === 'register'){
        regFields.style.display = 'block';
        loginIdentifier.style.display = 'none';
      } else {
        regFields.style.display = 'none';
        loginIdentifier.style.display = 'block';
      }
    }
    updateAvatarVisibility();
  });

  // previously used MutationObserver; now updateAvatarVisibility is called directly after mode switch

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    setMessage('Bitte warten...', false);
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;
    const avatarFile = avatarInput.files[0];

    if (mode === 'register'){
      // require username and email for registration
      const regUsername = document.getElementById('reg_username').value.trim();
      const regEmail = document.getElementById('reg_email').value.trim();
      if (!regUsername || !regEmail || !password){ setMessage('Bitte Benutzername, E‑Mail und Passwort angeben.', true); return; }
    } else {
      if (!identifier || !password){ setMessage('Bitte Benutzername/E‑Mail und Passwort angeben.', true); return; }
    }

    try {
      if (mode === 'register'){
        // read username + email from reg fields
        const regUsername = document.getElementById('reg_username').value.trim();
        const regEmail = document.getElementById('reg_email').value.trim();
        const { data, error } = await db.auth.signUp({ email: regEmail, password }, { data: { username: regUsername } });
        if (error) throw error;
        if (data && data.user){
          // upload avatar if present
          if (avatarFile){
            try {
              const fileName = `${data.user.id}/avatar_${Date.now()}.jpg`;
              const { error: upErr } = await db.storage.from('avatars').upload(fileName, avatarFile);
              if (upErr) console.warn('Avatar upload failed:', upErr.message || upErr);
            } catch(uploadError){ console.warn('Avatar upload exception', uploadError); }
          }
          // Auto-login after register
          const loginRes = await db.auth.signInWithPassword({ email, password });
          if (loginRes.error) throw loginRes.error;
          setMessage('Registrierung erfolgreich — eingeloggt.', false);
          showLoggedIn(loginRes.data.user);
        } else {
          setMessage('Registrierung abgeschlossen. Bitte prüfen Sie E‑Mail.', false);
        }
      } else {
        // login
        const email = identifier.includes('@') ? identifier : `${identifier}@wardrop.local`;
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data && data.user){
          setMessage('Login erfolgreich.', false);
          showLoggedIn(data.user);
        } else {
          setMessage('Login eventuell fehlgeschlagen.', true);
        }
      }
    } catch (err){
      console.error(err);
      setMessage(err.message || 'Fehler beim Auth.', true);
    }
  });

  // Show logged-in state and provide logout
  function showLoggedIn(user){
    try {
      form.style.display = 'none';
    } catch(e){}
    const box = document.getElementById('profileAuthBox') || document.querySelector('.auth-box');
    const info = document.createElement('div');
    info.className = 'logged-in-info';
    info.innerHTML = `<p>Angemeldet als <strong>${user.email || user.user_metadata?.username || 'User'}</strong></p>`;
    const outBtn = document.createElement('button');
    outBtn.textContent = 'Logout';
    outBtn.style.marginTop = '8px';
    outBtn.addEventListener('click', async ()=>{
      try {
        await logout();
        info.remove();
        form.style.display = '';
        setMessage('Ausgeloggt.', false);
      } catch(err){
        console.error('Logout error', err);
        setMessage('Fehler beim Logout.', true);
      }
    });
    info.appendChild(outBtn);
    box.appendChild(info);
  }

})();
