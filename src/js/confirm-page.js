/**
 * Get information about the page and the container name.
 * Add listeners to "deny" and "confirm" buttons so that when they are clicked,
 * they perform the correct functions.
 */
async function load() {
  const searchParams = new URL(window.location).searchParams;
  const redirectUrl = searchParams.get("url");
  const cookieStoreId = searchParams.get("cookieStoreId");
  const currentCookieStoreId = searchParams.get("currentCookieStoreId");
  const redirectUrlElement = document.getElementById("redirect-url");
  redirectUrlElement.textContent = redirectUrl;
  appendFavicon(redirectUrl, redirectUrlElement);

  const container = await browser.contextualIdentities.get(cookieStoreId);
  [...document.querySelectorAll(".container-name")].forEach((containerNameElement) => {
    containerNameElement.textContent = container.name;
  });

  // If default container, button will default to normal HTML content
  if (currentCookieStoreId) {
    const currentContainer = await browser.contextualIdentities.get(currentCookieStoreId);
    document.getElementById("current-container-name").textContent = currentContainer.name;
  }
  document.getElementById("deny").addEventListener("click", (e) => {
    e.preventDefault();
    denySubmit(redirectUrl);
  });

  document.getElementById("confirm").addEventListener("click", (e) => {
    e.preventDefault();
    confirmSubmit(redirectUrl, cookieStoreId);
  });
}

/**
 * Append the website favicon to the url that your trying to go to. This will
 * show the favicon with the url on the confirm page.
 */
function appendFavicon(pageUrl, redirectUrlElement) {
  const origin = new URL(pageUrl).origin;
  const favIconElement = Utils.createFavIconElement(`${origin}/favicon.ico`);

  redirectUrlElement.prepend(favIconElement);
}

/**
 * This is run when the user decides to open the site in the container they had
 * previously assigned the url to. It checks if they user said to remeber their
 * decision (neverAsk) and sends a message to the browser runtime to update
 * local storage with this information. Opens the site in the container.
 */
function confirmSubmit(redirectUrl, cookieStoreId) {
  const neverAsk = document.getElementById("never-ask").checked;
  // Sending neverAsk message to background to store for next time we see this process
  if (neverAsk) {
    browser.runtime.sendMessage({
      method: "neverAsk",
      neverAsk: true,
      pageUrl: redirectUrl
    });
  }
  openInContainer(redirectUrl, cookieStoreId);
}

/**
 * Return the tab that is active right now.
 */
function getCurrentTab() {
  return browser.tabs.query({
    active: true,
    windowId: browser.windows.WINDOW_ID_CURRENT
  });
}

/**
 * This is run when the user decides to open the site in the current container and tab.
 * It will send a message to open this site, but it only remembers to do this in this
 * tab. If the user were to repeat this process in a new tab, they would arrive confirm page.
 * 
 * The "Remeber my decision for this site" does not do anything if the user decides
 * to open the site in the current container.
 */
async function denySubmit(redirectUrl) {
  const tab = await getCurrentTab();
  await browser.runtime.sendMessage({
    method: "exemptContainerAssignment",
    tabId: tab[0].id,
    pageUrl: redirectUrl
  });
  document.location.replace(redirectUrl);
}

// Registers event handlers and favicon set up for the confirm page
load();

/**
 * Creates a new tab in the desired container with the url and removes the old tab.
 */
async function openInContainer(redirectUrl, cookieStoreId) {
  const tab = await getCurrentTab();
  await browser.tabs.create({
    index: tab[0].index + 1,
    cookieStoreId,
    url: redirectUrl
  });
  if (tab.length > 0) {
    browser.tabs.remove(tab[0].id);
  }
}
