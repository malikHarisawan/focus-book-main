const tokenInput = document.getElementById('token')
const saveButton = document.getElementById('save')
const statusEl = document.getElementById('status')

chrome.storage.local.get('focusbookToken', (stored) => {
  if (stored.focusbookToken) {
    tokenInput.value = stored.focusbookToken
    statusEl.textContent = 'Token saved. The extension will connect automatically.'
    statusEl.className = 'ok'
  }
})

saveButton.addEventListener('click', () => {
  const token = tokenInput.value.trim()
  if (!token) {
    statusEl.textContent = 'Please paste a token first.'
    statusEl.className = ''
    return
  }
  chrome.storage.local.set({ focusbookToken: token }, () => {
    statusEl.textContent = 'Token saved. Connecting to FocusBook…'
    statusEl.className = 'ok'
  })
})
