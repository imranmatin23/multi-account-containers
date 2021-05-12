const MAJOR_VERSIONS = ["2.3.0", "2.4.0", "6.2.0"];
const badge = {

  /**
   * Wrapper that calls displayBrowserActionBadge in the current window.
   */
  async init() {
    const currentWindow = await browser.windows.getCurrent();
    this.displayBrowserActionBadge(currentWindow);
  },

  /**
   * UI logic for displaying the browserActionBadge. It shows a green box that
   * says new ontop of the multi-account containers icon in the browser toolbar
   * if there is a new version and you haven't clicked it yet.
   * 
   * What is the BrowserActionBadge? A browser action is a button that your extension adds to the browser's toolbar. 
   */
  async displayBrowserActionBadge() {
    const extensionInfo = await backgroundLogic.getExtensionInfo();
    const storage = await browser.storage.local.get({ browserActionBadgesClicked: [] });

    if (MAJOR_VERSIONS.indexOf(extensionInfo.version) > -1 &&
      storage.browserActionBadgesClicked.indexOf(extensionInfo.version) < 0) {
      browser.browserAction.setBadgeBackgroundColor({ color: "rgba(0,217,0,255)" });
      browser.browserAction.setBadgeText({ text: "NEW" });
    }
  }
};

// Only runs once, and checks if should display mulit-account containers badge
// in browser toolbar with a new indicator or not.
badge.init();
