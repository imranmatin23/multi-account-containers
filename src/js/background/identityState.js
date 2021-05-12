window.identityState = {
  keyboardShortcut: {},
  storageArea: {
    area: browser.storage.local,

    /**
     * Get the containerStoreKey using the cookieStoreId by prefixing it with
     * how it is stored in browser storage.
     */
    getContainerStoreKey(cookieStoreId) {
      const storagePrefix = "identitiesState@@_";
      return `${storagePrefix}${cookieStoreId}`;
    },

    /**
     * Get's the containerState from the storage. The first if is handling
     * when the container is stored in storage without a UUID, and if so it just
     * adds that first. If not that case, then confirm that this container is
     * in use and return the default container state for this container.
     */
    async get(cookieStoreId) {
      const storeKey = this.getContainerStoreKey(cookieStoreId);
      const storageResponse = await this.area.get([storeKey]);
      if (storageResponse && storeKey in storageResponse) {
        if (!storageResponse[storeKey].macAddonUUID){
          storageResponse[storeKey].macAddonUUID = uuidv4();
          await this.set(cookieStoreId, storageResponse[storeKey]);
        }
        return storageResponse[storeKey];
      }
      // If local storage doesn't have an entry, look it up to make sure it's
      // an in-use identity.
      const identities = await browser.contextualIdentities.query({});
      const match = identities.find(
        (identity) => identity.cookieStoreId === cookieStoreId);
      if (match) {
        const defaultContainerState = identityState._createIdentityState();
        await this.set(cookieStoreId, defaultContainerState);
        return defaultContainerState;
      }
      return false;
    },

    /**
     * Save the containerState for a container into the browser storage.
     */
    set(cookieStoreId, data) {
      const storeKey = this.getContainerStoreKey(cookieStoreId);
      return this.area.set({
        [storeKey]: data
      });
    },

    /**
     * Remove the containerState for a container into the browser storage.
     */
    async remove(cookieStoreId) {
      const storeKey = this.getContainerStoreKey(cookieStoreId);
      return this.area.remove([storeKey]);
    },

    /**
     * Set a keyboard shortcut to map to a certain container. Save this information
     * into the browswer local storage.
     */
    async setKeyboardShortcut(shortcutId, cookieStoreId) {
      identityState.keyboardShortcut[shortcutId] = cookieStoreId;
      return this.area.set({[shortcutId]: cookieStoreId});
    },

    /**
     * Get all of the keyboard shortcuts (and which container they map to if they
     * have one) from browswer storage and return them
     */
    async loadKeyboardShortcuts () {
      const identities = await browser.contextualIdentities.query({});
      for (let i=0; i < backgroundLogic.NUMBER_OF_KEYBOARD_SHORTCUTS; i++) {
        const key = "open_container_" + i;
        const storageObject = await this.area.get(key);
        if (storageObject[key]){
          identityState.keyboardShortcut[key] = storageObject[key];
          continue;
        }
        if (identities[i]) {
          identityState.keyboardShortcut[key] = identities[i].cookieStoreId;
          continue;
        }
        identityState.keyboardShortcut[key] = "none";
      }
      return identityState.keyboardShortcut;
    },

    /*
     * Looks for abandoned identity keys in local storage, and makes sure all
     * identities registered in the browser are also in local storage. (this
     * appears to not always be the case based on how this.get() is written)
     * 
     * Ensure that all containers have a UUID for them in storage. Ensure that
     * any containers that are the default container, if they were not found in
     * storage and in the the current browser then it is a stale container and
     * remove it. 
     */
    async upgradeData() {
      const identitiesList = await browser.contextualIdentities.query({});

      for (const identity of identitiesList) {
        // ensure all identities have an entry in local storage
        await identityState.addUUID(identity.cookieStoreId);
      }
      
      const macConfigs = await this.area.get();
      for(const configKey of Object.keys(macConfigs)) {
        if (configKey.includes("identitiesState@@_")) {
          const cookieStoreId = String(configKey).replace(/^identitiesState@@_/, "");
          const match = identitiesList.find(
            localIdentity => localIdentity.cookieStoreId === cookieStoreId
          );
          if (cookieStoreId === "firefox-default") continue;
          if (!match) {
            await this.remove(cookieStoreId);
            continue;
          }
          if (!macConfigs[configKey].macAddonUUID) {
            await identityState.storageArea.get(cookieStoreId);
          }
        }
      }
    },

  },

  /**
   * Wrapper to create a tab object.
   */
  _createTabObject(tab) {
    return Object.assign({}, tab);
  },

  /**
   * For each contextualIdentity in the browser, get a map of cookieStoreId to
   * UUID.
   */
  async getCookieStoreIDuuidMap() {
    const containers = {};
    const identities = await browser.contextualIdentities.query({});
    for(const identity of identities) {
      const containerInfo = await this.storageArea.get(identity.cookieStoreId);
      containers[identity.cookieStoreId] = containerInfo.macAddonUUID;
    }
    return containers;
  },

  /**
   * Update the storage with the new container state because we have now hidden
   * some tabs for this container.
   */
  async storeHidden(cookieStoreId, windowId) {
    const containerState = await this.storageArea.get(cookieStoreId);
    const tabsByContainer = await browser.tabs.query({cookieStoreId, windowId});
    tabsByContainer.forEach((tab) => {
      const tabObject = this._createTabObject(tab);
      if (!backgroundLogic.isPermissibleURL(tab.url)) {
        return;
      }
      // This tab is going to be closed. Let's mark this tabObject as
      // non-active.
      tabObject.active = false;
      tabObject.hiddenState = true;
      containerState.hiddenTabs.push(tabObject);
    });

    return this.storageArea.set(cookieStoreId, containerState);
  },

  /**
   * Update the UUID in storage for a container.
   */
  async updateUUID(cookieStoreId, uuid) {
    if (!cookieStoreId || !uuid) {
      throw new Error ("cookieStoreId or uuid missing");
    }
    const containerState = await this.storageArea.get(cookieStoreId);
    containerState.macAddonUUID = uuid;
    await this.storageArea.set(cookieStoreId, containerState);
    return uuid;
  },

  /**
   * If this cookieStoreId is missing a UUID in storage, calling get will create
   * a UUID for it.
   */
  async addUUID(cookieStoreId) {
    await this.storageArea.get(cookieStoreId);
  },

  /**
   * Get the macAddonUUId for the container specified from storage.
   */
  async lookupMACaddonUUID(cookieStoreId) {
    // This stays a lookup, because if the cookieStoreId doesn't 
    // exist, this.get() will create it, which is not what we want.
    const cookieStoreIdKey = cookieStoreId.includes("firefox-container-") ? 
      cookieStoreId : "firefox-container-" + cookieStoreId;
    const macConfigs = await this.storageArea.area.get();
    for(const configKey of Object.keys(macConfigs)) {
      if (configKey === this.storageArea.getContainerStoreKey(cookieStoreIdKey)) {
        return macConfigs[configKey].macAddonUUID;
      }
    }
    return false;
  },

  /**
   * Get the cookieStoreId for the macAddonUID specified from storage.
   */
  async lookupCookieStoreId(macAddonUUID) {
    const macConfigs = await this.storageArea.area.get();
    for(const configKey of Object.keys(macConfigs)) {
      if (configKey.includes("identitiesState@@_")) {
        if(macConfigs[configKey].macAddonUUID === macAddonUUID) {
          return String(configKey).replace(/^identitiesState@@_/, "");
        }
      }
    }
    return false;
  },

  /**
   * Creates a new identity state that is used for a container.
   */
  _createIdentityState() {
    return {
      hiddenTabs: [],
      macAddonUUID: uuidv4()
    };
  },

  /**
   * Calls loadKeyboardShortcuts which loads all keyboard shortcut to container
   * mappings.
   */
  init() {
    this.storageArea.loadKeyboardShortcuts();
  }
};

// Calls init to load keyboardShortcuts.
identityState.init();

/**
 * Computes a UUID.
 */
function uuidv4() {
  // https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}
