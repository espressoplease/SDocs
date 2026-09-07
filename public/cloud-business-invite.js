(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');
  var preview = params.get('preview') === 'signin';
  var authCard = document.getElementById('invite-auth');
  var acceptCard = document.getElementById('invite-accept');
  var button = document.getElementById('accept-invite');
  var status = document.getElementById('invite-status');
  var firstName = document.getElementById('invite-first-name');
  var lastName = document.getElementById('invite-last-name');
  var profileLoaded = false;

  function readResponse(response) {
    return response.json().then(function (body) { return { response: response, body: body }; });
  }

  function show(message, error) {
    status.textContent = message;
    status.style.color = error ? 'var(--red)' : '';
  }

  function refreshButton() {
    button.disabled = !profileLoaded || !firstName.value.trim() || !lastName.value.trim();
  }

  function showProfile(user) {
    authCard.hidden = true;
    acceptCard.hidden = false;
    document.getElementById('invite-email').textContent = user.email || '';
    firstName.value = user.first_name || '';
    lastName.value = user.last_name || '';
    profileLoaded = true;
    refreshButton();
  }

  firstName.addEventListener('input', refreshButton);
  lastName.addEventListener('input', refreshButton);

  if (preview) {
    document.getElementById('preview-note').hidden = false;
    return;
  }

  if (!token) {
    document.getElementById('prototype-status').textContent =
      'This invitation link is incomplete. Ask the sender for a new link.';
    return;
  }

  fetch('/api/cloud/v1/me', { credentials: 'same-origin' }).then(readResponse).then(function (result) {
    if (result.response.status === 401) return;
    if (result.response.status === 403 && result.body.error === 'terms_acceptance_required') {
      window.location.assign('/cloud/terms?return=' + encodeURIComponent(
        window.location.pathname + window.location.search));
      return;
    }
    if (!result.response.ok) throw new Error('Your account details could not be loaded.');
    showProfile(result.body.user);
  }).catch(function (error) {
    document.getElementById('prototype-status').textContent =
      error.message || 'Your account details could not be loaded.';
  });

  button.addEventListener('click', function () {
    button.disabled = true;
    show('Saving your details...');
    fetch('/api/cloud/v1/me', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName.value.trim(), last_name: lastName.value.trim() }),
    }).then(readResponse).then(function (profileResult) {
      if (profileResult.response.status === 401) {
        window.location.reload();
        throw new Error('login_required');
      }
      if (!profileResult.response.ok) throw new Error('Enter your first and last name.');
      show('Starting your trial...');
      return fetch('/api/cloud/v1/invitations/' + encodeURIComponent(token) + '/accept', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).then(readResponse);
    }).then(function (result) {
      if (!result.response.ok) {
        if (result.body.error === 'permission_denied') {
          throw new Error('Sign in with the email address that received this invitation.');
        }
        if (result.body.error === 'profile_required') {
          throw new Error('Enter your first and last name.');
        }
        throw new Error('This invitation is no longer available.');
      }
      show('Trial started. Opening your Cloud library...');
      window.location.assign('/library?scope=cloud&workspace=' + encodeURIComponent(result.body.workspace_id));
    }).catch(function (error) {
      if (error.message === 'login_required') return;
      refreshButton();
      show(error.message || 'The invitation could not be accepted.', true);
    });
  });
})();
