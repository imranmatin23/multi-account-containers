const NUMBER_OF_KEYBOARD_SHORTCUTS = 10;

/**
 * Event handler function that sends a browser runtime message to messagehandler.js 
 * based on if the user has selected to allow bookmarks permission to be used by
 * multi-account containers.
 */
async function requestPermissions() {
  const checkbox = document.querySelector("#bookmarksPermissions");
  if (checkbox.checked) {
    const granted = await browser.permissions.request({permissions: ["bookmarks"]});
    if (!granted) { 
      checkbox.checked = false; 
      return;
    }
  } else {
    await browser.permissions.remove({permissions: ["bookmarks"]});
  }
  browser.runtime.sendMessage({ method: "resetBookmarksContext" });
}

/**
 * Event handler function that sends a browser runtime message to messagehandler.js 
 * based on if the user has selected sync as enable or disable.
 */
async function enableDisableSync() {
  const checkbox = document.querySelector("#syncCheck");
  await browser.storage.local.set({syncEnabled: !!checkbox.checked});
  browser.runtime.sendMessage({ method: "resetSync" });
}

/**
 * Event handler function that sends a browser runtime message to messagehandler.js 
 * based on if the user has selected to replace the tab or not when going into
 * a new url.
 */
async function enableDisableReplaceTab() {
  const checkbox = document.querySelector("#replaceTabCheck");
  await browser.storage.local.set({replaceTabEnabled: !!checkbox.checked});
}

/**
 * When the page loads, set up these options by prepopulating them.
 */
async function setupOptions() {
  const hasPermission = await browser.permissions.contains({permissions: ["bookmarks"]});
  const { syncEnabled } = await browser.storage.local.get("syncEnabled");
  const { replaceTabEnabled } = await browser.storage.local.get("replaceTabEnabled");
  if (hasPermission) {
    document.querySelector("#bookmarksPermissions").checked = true;
  }
  document.querySelector("#syncCheck").checked = !!syncEnabled;
  document.querySelector("#replaceTabCheck").checked = !!replaceTabEnabled;
  setupContainerShortcutSelects();
}

/**
 * When the page loads, set up these shortcuts in the options by prepopulating them
 * with the shortcuts you had before.
 */
async function setupContainerShortcutSelects () {
  const keyboardShortcut = await browser.runtime.sendMessage({method: "getShortcuts"});
  const identities = await browser.contextualIdentities.query({});
  const fragment = document.createDocumentFragment();
  const noneOption = document.createElement("option");
  noneOption.value = "none";
  noneOption.id = "none";
  noneOption.textContent = "None";
  fragment.append(noneOption);

  for (const identity of identities) {
    const option = document.createElement("option");
    option.value = identity.cookieStoreId;
    option.id = identity.cookieStoreId;
    option.textContent = identity.name;
    fragment.append(option);
  }

  for (let i=0; i < NUMBER_OF_KEYBOARD_SHORTCUTS; i++) {
    const shortcutKey = "open_container_"+i;
    const shortcutSelect = document.getElementById(shortcutKey);
    shortcutSelect.appendChild(fragment.cloneNode(true));
    if (keyboardShortcut && keyboardShortcut[shortcutKey]) {
      const cookieStoreId = keyboardShortcut[shortcutKey];
      shortcutSelect.querySelector("#" + cookieStoreId).selected = true;
    }
  }
}

/**
 * Event handler function that sends a browser runtime message to messagehandler.js
 * to update the shortcut with a new container.
 */
function storeShortcutChoice (event) {
  browser.runtime.sendMessage({
    method: "setShortcut",
    shortcut: event.target.id,
    cookieStoreId: event.target.value
  });
}

/**
 * Resets the onboarding stage flag to 0 in local storage to onboard again.
 */
function resetOnboarding() {
  browser.storage.local.set({"onboarding-stage": 0});
}

/**
 * Add event listeners and query selectors that run when the page is loaded or
 * options are changed on the page.
 */
document.addEventListener("DOMContentLoaded", setupOptions);
document.querySelector("#bookmarksPermissions").addEventListener( "change", requestPermissions);
document.querySelector("#syncCheck").addEventListener( "change", enableDisableSync);
document.querySelector("#replaceTabCheck").addEventListener( "change", enableDisableReplaceTab);
document.querySelector("button").addEventListener("click", resetOnboarding);
for (let i=0; i < NUMBER_OF_KEYBOARD_SHORTCUTS; i++) {
  document.querySelector("#open_container_"+i)
    .addEventListener("change", storeShortcutChoice);
}