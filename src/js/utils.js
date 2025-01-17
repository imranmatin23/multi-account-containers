const DEFAULT_FAVICON = "/img/blank-favicon.svg";

// TODO use export here instead of globals
const Utils = {

  /**
   * Creates a favicon element and returns it.
   */
  createFavIconElement(url) {
    const imageElement = document.createElement("img");
    imageElement.classList.add("icon", "offpage", "menu-icon");
    imageElement.src = url;
    const loadListener = (e) => {
      e.target.classList.remove("offpage");
      e.target.removeEventListener("load", loadListener);
      e.target.removeEventListener("error", errorListener);
    };
    const errorListener = (e) => {
      e.target.src = DEFAULT_FAVICON;
    };
    imageElement.addEventListener("error", errorListener);
    imageElement.addEventListener("load", loadListener);
    return imageElement;
  },
  /**
 * Escapes any occurances of &, ", <, > or / with XML entities.
 *
 * @param {string} str
 *        The string to escape.
 * @return {string} The escaped string.
 */
  escapeXML(str) {
    const replacements = { "&": "&amp;", "\"": "&quot;", "'": "&apos;", "<": "&lt;", ">": "&gt;", "/": "&#x2F;" };
    return String(str).replace(/[&"'<>/]/g, m => replacements[m]);
  },

  /**
 * A tagged template function which escapes any XML metacharacters in
 * interpolated values.
 *
 * @param {Array<string>} strings
 *        An array of literal strings extracted from the templates.
 * @param {Array} values
 *        An array of interpolated values extracted from the template.
 * @returns {string}
 *        The result of the escaped values interpolated with the literal
 *        strings.
 */
  escaped(strings, ...values) {
    const result = [];

    for (const [i, string] of strings.entries()) {
      result.push(string);
      if (i < values.length)
        result.push(this.escapeXML(values[i]));
    }

    return result.join("");
  },

  /**
   * Gets the current tab.
   */
  async currentTab() {
    const activeTabs = await browser.tabs.query({ active: true, windowId: browser.windows.WINDOW_ID_CURRENT });
    if (activeTabs.length > 0) {
      return activeTabs[0];
    }
    return false;
  },
  
  /**
   * Set listeners for when you click or press enter
   */
  addEnterHandler(element, handler) {
    element.addEventListener("click", (e) => {
      handler(e);
    });
    element.addEventListener("keydown", (e) => {
      if (e.keyCode === 13) {
        e.preventDefault();
        handler(e);
      }
    });
  },

  /**
   * Set listener for only when you press enter.
   */
  addEnterOnlyHandler(element, handler) {
    element.addEventListener("keydown", (e) => {
      if (e.keyCode === 13) {
        e.preventDefault();
        handler(e);
      }
    });
  },  

  /**
   * Gets the userContextId from the cookieStoreId.
   */
  userContextId(cookieStoreId = "") {
    const userContextId = cookieStoreId.replace("firefox-container-", "");
    return (userContextId !== cookieStoreId) ? Number(userContextId) : false;
  },

  /**
   * Send a set or remove message to messagehandler.js to either set or remove
   * and assignment of a url to a container.
   */
  setOrRemoveAssignment(tabId, url, userContextId, value) {
    return browser.runtime.sendMessage({
      method: "setOrRemoveAssignment",
      tabId,
      url,
      userContextId,
      value
    });
  },

  /**
   * Sends a message to messagehandler.js to reload a url in a specific container.
   */
  async reloadInContainer(url, currentUserContextId, newUserContextId, tabIndex, active) {
    return await browser.runtime.sendMessage({
      method: "reloadInContainer",
      url, 
      currentUserContextId, 
      newUserContextId, 
      tabIndex, 
      active
    });
  },

  /**
   * If the currentTab's url isn't already loaded into the right container, then
   * assign it and reload the page in the right container. Else if it is, then
   * just assign the url to that container.
   */
  async alwaysOpenInContainer(identity) {
    const currentTab = await this.currentTab();
    const assignedUserContextId = this.userContextId(identity.cookieStoreId);
    if (currentTab.cookieStoreId !== identity.cookieStoreId) {
      return await browser.runtime.sendMessage({
        method: "assignAndReloadInContainer",
        url: currentTab.url, 
        currentUserContextId: false, 
        newUserContextId: assignedUserContextId, 
        tabIndex: currentTab.index +1, 
        active:currentTab.active
      });
    }
    await Utils.setOrRemoveAssignment(
      currentTab.id, 
      currentTab.url, 
      assignedUserContextId, 
      false
    );
  }

};

// asign Utils object for this window.
window.Utils = Utils;