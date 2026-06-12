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
  const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes cooldown for email rate limit

  function getRateLimitUntil(){
    const v = sessionStorage.getItem('auth_rate_limit_until');
    return v ? parseInt(v,10) : 0;
  }

  function setRateLimitUntil(ts){
    sessionStorage.setItem('auth_rate_limit_until', String(ts));
  }

  let rateLimitTimer = null;
  function startRateLimitCountdown(){
    clearInterval(rateLimitTimer);
    const until = getRateLimitUntil();
    if (!until || until <= Date.now()){
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = true;
    rateLimitTimer = setInterval(()=>{
      const remaining = until - Date.now();
      if (remaining <= 0){
        clearInterval(rateLimitTimer);
        sessionStorage.removeItem('auth_rate_limit_until');
        submitBtn.disabled = false;
        setMessage('', false);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setMessage(`Zu viele Anfragen — bitte in ${mins}m ${secs}s erneut versuchen.`, true);
    }, 1000);
  }

  function handleRateLimit(ms){
    const until = Date.now() + ms;
    setRateLimitUntil(until);
    startRateLimitCountdown();
  }

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

  // if a rate-limit cooldown is active from a previous attempt, start countdown
  startRateLimitCountdown();

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
        // attempt signUp and handle rate-limit errors gracefully
        const signRes = await db.auth.signUp({ email: regEmail, password, options: { data: { username: regUsername } } });
        if (signRes.error){
          const msg = (signRes.error && (signRes.error.message || (signRes.error.error && signRes.error.error.message))) || '';
          if (msg.toLowerCase().includes('rate')){
            // email rate limit exceeded
            handleRateLimit(RATE_LIMIT_MS);
            return;
          }
          throw signRes.error;
        }
        const data = signRes.data;
        if (data && data.user){
          // upload avatar if present
          if (avatarFile){
            try {
              const fileName = `${data.user.id}/avatar_${Date.now()}.jpg`;
              const { error: upErr } = await db.storage.from('avatars').upload(fileName, avatarFile);
              if (upErr) console.warn('Avatar upload failed:', upErr.message || upErr);
            } catch(uploadError){ console.warn('Avatar upload exception', uploadError); }
          }
          // Auto-login after register (may fail if email confirmation is required)
          try {
            const loginRes = await db.auth.signInWithPassword({ email: regEmail, password });
            if (loginRes.error) throw loginRes.error;
            setMessage('Registrierung erfolgreich — eingeloggt.', false);
            showLoggedIn(loginRes.data.user);
          } catch (loginErr) {
            console.warn('Auto-login failed after signUp:', loginErr);
            const msg = (loginErr && (loginErr.message || loginErr.error && loginErr.error.message)) || '';
            if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('confirm')) {
              setMessage('Registrierung abgeschlossen. Bitte bestätige deine E‑Mail per Link.', false);
            } else {
              setMessage('Registrierung abgeschlossen. Bitte melde dich an.', false);
            }
          }
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
  async function showLoggedIn(user){
    try { form.style.display = 'none'; } catch(e){}

    // hide the register/login toggles
    const regFields = document.getElementById('regFields');
    const loginIdentifier = document.getElementById('loginIdentifier');
    const authSwitch = document.querySelector('.auth-switch');
    if (regFields) regFields.style.display = 'none';
    if (loginIdentifier) loginIdentifier.style.display = 'none';
    if (authSwitch) authSwitch.style.display = 'none';

      // Always try to get latest current user from Supabase to ensure metadata is present
      try {
        const current = await getCurrentUser();
        if (current) user = current;
      } catch(e){ console.warn('getCurrentUser failed', e); }

    const box = document.getElementById('profileAuthBox') || document.querySelector('.auth-box');

    // remove any existing profile view
    const existing = box.querySelector('.profile-view');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'profile-view';

    // Logout toggle (top-right small red rounded box that expands on hover)
    const logoutToggle = document.createElement('button');
    logoutToggle.className = 'logout-toggle';
    logoutToggle.setAttribute('aria-label', 'Logout');
    logoutToggle.innerHTML = '<span class="icon">⎋</span><span class="text">Logout</span>';
    logoutToggle.addEventListener('click', async ()=>{
      try {
        await logout();
      } catch(err){ console.error('Logout error', err); }
      // remove profile view and restore form / switches
      container.remove();
      try { form.style.display = ''; } catch(e){}
      if (regFields) regFields.style.display = 'none';
      if (loginIdentifier) loginIdentifier.style.display = 'block';
      if (authSwitch) authSwitch.style.display = 'flex';
      // restore title and submit button
      try { document.getElementById('authTitle').textContent = 'Login'; } catch(e){}
      try { submitBtn.textContent = 'Login'; } catch(e){}
      mode = 'login';
      updateAvatarVisibility();
      setMessage('Ausgeloggt.', false);
    });

    // Determine display username (prefer stored username, else derive from email local-part)
    const displayName = user?.user_metadata?.username || (user?.email ? user.email.split('@')[0] : null) || 'User';
    // set profile title to 'Profil'
    try { document.getElementById('authTitle').textContent = 'Profil'; } catch(e){}

    // Profile avatar (prefer user metadata avatar_url, else use current preview, else initials)
    const avatarEl = document.createElement('div');
    avatarEl.className = 'profile-avatar';
    const metaAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.avatar || null;
    const previewImg = avatarPreview && avatarPreview.querySelector && avatarPreview.querySelector('img') ? avatarPreview.querySelector('img').src : null;
    if (metaAvatar) {
      const img = document.createElement('img'); img.src = metaAvatar; img.alt = displayName || 'Avatar'; avatarEl.appendChild(img);
    } else if (previewImg) {
      const img = document.createElement('img'); img.src = previewImg; img.alt = displayName || 'Avatar'; avatarEl.appendChild(img);
    } else {
      const initials = document.createElement('div'); initials.className = 'avatar-initials';
      initials.textContent = (displayName && displayName[0]) ? displayName[0].toUpperCase() : 'U';
      avatarEl.appendChild(initials);
    }

    // Username centered
    const usernameEl = document.createElement('div');
    usernameEl.className = 'profile-username';
    usernameEl.textContent = displayName;

    // Favorites box (placeholder)
    const favoritesBox = document.createElement('div');
    favoritesBox.className = 'favorites-box';
    favoritesBox.innerHTML = '<h3>Favoriten Fits</h3><div class="favorites-empty">Noch keine Favoriten</div>';

    container.appendChild(logoutToggle);
    container.appendChild(avatarEl);
    container.appendChild(usernameEl);
    container.appendChild(favoritesBox);

    box.appendChild(container);
  }

})();
