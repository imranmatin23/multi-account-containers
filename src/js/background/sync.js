const SYNC_DEBUG = false;

const sync = {
  storageArea: {
    /**
     * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync
     * Represents the sync storage area. Items in sync storage are synced by the browser, and are available across all instances of that browser that the user is logged into (e.g. via Firefox sync, or a Google account), across different devices.
     */
    area: browser.storage.sync,

    /**
     * Get all the data stored in the sync storage.
     */
    async get(){
      return this.area.get();
    },

    /**
     * Store some data into sync storage.
     */
    async set(options) {
      return this.area.set(options);
    },

    /**
     * If you haven't already deleted this Identity, then update the deleted
     * identity list and store that list back into sync storage. Also, remove
     * the actualy identity from the sync storage as well.
     */
    async deleteIdentity(deletedIdentityUUID) {
      const deletedIdentityList = 
        await sync.storageArea.getDeletedIdentityList();
      if (
        ! deletedIdentityList.find(element => element === deletedIdentityUUID)
      ) {
        deletedIdentityList.push(deletedIdentityUUID);
        await sync.storageArea.set({ deletedIdentityList });
      }
      await this.removeIdentityKeyFromSync(deletedIdentityUUID);
    },

    /**
     * Remove an identity from sync storage.
     */
    async removeIdentityKeyFromSync(deletedIdentityUUID) {
      await sync.storageArea.area.remove( "identity@@_" + deletedIdentityUUID);
    },

    /**
     * If you haven't already deleted this site, then update the deleted
     * site list and store that list back into sync storage. Also, remove
     * the actual site from the sync storage as well.
     */
    async deleteSite(siteStoreKey) {
      const deletedSiteList = 
        await sync.storageArea.getDeletedSiteList();
      if (deletedSiteList.find(element => element === siteStoreKey)) return;
      deletedSiteList.push(siteStoreKey);
      await sync.storageArea.set({ deletedSiteList });
      await sync.storageArea.area.remove(siteStoreKey);
    },

    /**
     * Get the list of deleted Identities from the sync storage.
     */
    async getDeletedIdentityList() {
      const storedArray = await this.getStoredItem("deletedIdentityList");
      return storedArray || [];
    },

    /**
     * Get all the identities that are stored in sync storage.
     */
    async getIdentities() {
      const allSyncStorage = await this.get();
      const identities = [];
      for (const storageKey of Object.keys(allSyncStorage)) {
        if (storageKey.includes("identity@@_")) {
          identities.push(allSyncStorage[storageKey]);
        }
      }
      return identities;
    },

    /**
     * Get the list of deleted sites from the sync storage.
     */
    async getDeletedSiteList() { 
      const storedArray = await this.getStoredItem("deletedSiteList");
      return (storedArray) ?  storedArray : [];
    },

    /**
     * Get the list of assigned sites for all containers from sync storage.
     */
    async getAssignedSites() {
      const allSyncStorage = await this.get();
      const sites = {};
      for (const storageKey of Object.keys(allSyncStorage)) {
        if (storageKey.includes("siteContainerMap@@_")) {
          sites[storageKey] = allSyncStorage[storageKey];
        }
      }
      return sites;
    },

    /**
     * Wrapper to actually get the object from sync storage.
     */
    async getStoredItem(objectKey) {
      const outputObject = await this.get(objectKey);
      if (outputObject && outputObject[objectKey]) 
        return outputObject[objectKey];
      return false;
    },

    /**
     * Get all the data from sync storage that includes "MACinstance" in its key.
     */
    async getAllInstanceInfo() {
      const instanceList = {};
      const allSyncInfo = await this.get();
      for (const objectKey of Object.keys(allSyncInfo)) {
        if (objectKey.includes("MACinstance")) {
          instanceList[objectKey] = allSyncInfo[objectKey]; }
      }
      return instanceList;
    },

    /**
     * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/getURL
     * Returns this --> MACinstance://2c127fa4-62c7-7e4f-90e5-472b45eecfdc
     * 
     * We believe this is a unique identifier for this instance of multi-account containers
     * for this user in this browser.
     */
    getInstanceKey() {
      return browser.runtime.getURL("")
        .replace(/moz-extension:\/\//, "MACinstance:")
        .replace(/\//, "");
    },

    /**
     * Remove the instance UUID from sync storage
     */
    async removeInstance(installUUID) {
      if (SYNC_DEBUG) console.log("removing", installUUID);
      await this.area.remove(installUUID);
      return;
    },

    /**
     * Wrapper that gets the instance key and then calls another function to
     * acually remove it.
     */
    async removeThisInstanceFromSync() {
      const installUUID = this.getInstanceKey();
      await this.removeInstance(installUUID);
      return;
    },

    /**
     * Checking if there is anything in sync storage.
     */
    async hasSyncStorage(){
      const inSync = await this.get();
      return !(Object.entries(inSync).length === 0);
    },

    /**
     * Remove the listeners because don't want to retrigger backup when changing
     * sync storage. Update the site assignments and identites in lcoal storage.
     * Update the complete instance and by writing current state of instance to
     * sync storage. Based on what was passsed in, perform the correct actions.
     * Refer to function descriptions for each case.
     */
    async backup(options) {
      // remove listeners to avoid an infinite loop!
      await sync.checkForListenersMaybeRemove();

      const identities = await updateSyncIdentities();
      const siteAssignments = await updateSyncSiteAssignments();
      await updateInstanceInfo(identities, siteAssignments);
      if (options && options.uuid) 
        await this.deleteIdentity(options.uuid);
      if (options && options.undeleteUUID) 
        await removeFromDeletedIdentityList(options.undeleteUUID);
      if (options && options.siteStoreKey) 
        await this.deleteSite(options.siteStoreKey);
      if (options && options.undeleteSiteStoreKey) 
        await removeFromDeletedSitesList(options.undeleteSiteStoreKey);

      if (SYNC_DEBUG) console.log("Backed up!");
      await sync.checkForListenersMaybeAdd();

      /**
       * For each identity, if there exists an identity in the browswer 
       * then write the identity to sync storage.
       */
      async function updateSyncIdentities() {
        const identities = await browser.contextualIdentities.query({});

        for (const identity of identities) {
          delete identity.colorCode;
          delete identity.iconUrl;
          identity.macAddonUUID = await identityState.lookupMACaddonUUID(identity.cookieStoreId);
          if(identity.macAddonUUID) {
            const storageKey = "identity@@_" + identity.macAddonUUID;
            await sync.storageArea.set({ [storageKey]: identity });
          }
        }
        //await sync.storageArea.set({ identities });
        return identities;
      }

      /**
       * Adding any assigned sites to sync storage that were not assigned before.
       */
      async function updateSyncSiteAssignments() {
        const assignedSites = 
          await assignManager.storageArea.getAssignedSites();
        for (const siteKey of Object.keys(assignedSites)) {
          await sync.storageArea.set({ [siteKey]: assignedSites[siteKey] });
        }
        return assignedSites;
      }

      /**
       * For this instance of multi-account containers, get all the identites and
       * site assignments and set that information into sync storage with a timestamp.
       */
      async function updateInstanceInfo(identitiesInput, siteAssignmentsInput) {
        const date = new Date();
        const timestamp = date.getTime();
        const installUUID = sync.storageArea.getInstanceKey();
        if (SYNC_DEBUG) console.log("adding", installUUID);
        const identities = [];
        const siteAssignments = [];
        for (const identity of identitiesInput) {
          identities.push(identity.macAddonUUID);
        }
        for (const siteAssignmentKey of Object.keys(siteAssignmentsInput)) {
          siteAssignments.push(siteAssignmentKey);
        }
        await sync.storageArea.set({ [installUUID]: { timestamp, identities, siteAssignments } });
      }

      /**
       * Remove the identity from the removedIdentityList in sync storage.
       */
      async function removeFromDeletedIdentityList(identityUUID) {
        const deletedIdentityList = 
          await sync.storageArea.getDeletedIdentityList();
        const newDeletedIdentityList = deletedIdentityList
          .filter(element => element !== identityUUID);
        await sync.storageArea.set({ deletedIdentityList: newDeletedIdentityList });
      }

      /**
       * Remove the site from the removedSiteList in sync storage.
       */
      async function removeFromDeletedSitesList(siteStoreKey) {
        const deletedSiteList = 
          await sync.storageArea.getDeletedSiteList();
        const newDeletedSiteList = deletedSiteList
          .filter(element => element !== siteStoreKey);
        await sync.storageArea.set({ deletedSiteList: newDeletedSiteList });
      }
    },

    /**
     * Anytime the sync area is changed, run the error handling protocol.
     */
    onChangedListener(changes, areaName) {
      if (areaName === "sync") sync.errorHandledRunSync();
    },

    /**
     * Removing an identity from local storage and storing that update in sync storage.
     */
    async addToDeletedList(changeInfo) {
      const identity = changeInfo.contextualIdentity;
      const deletedUUID = 
        await identityState.lookupMACaddonUUID(identity.cookieStoreId);
      await identityState.storageArea.remove(identity.cookieStoreId);
      sync.storageArea.backup({uuid: deletedUUID});
    }
  },

  /**
   * If the user has enabeled syncing then add the listeners else remove them.
   */
  async init() {
    const syncEnabled = await assignManager.storageArea.getSyncEnabled();
    if (syncEnabled) {
      // Add listener to sync storage and containers.
      // Works for all installs that have any sync storage.
      // Waits for sync storage change before kicking off the restore/backup
      // initial sync must be kicked off by user.
      this.checkForListenersMaybeAdd();
      return;
    }
    this.checkForListenersMaybeRemove();

  },

  /**
   * Wrapper to call runSync() and then if there is an error add the listeners.
   */
  async errorHandledRunSync () {
    await sync.runSync().catch( async (error)=> { 
      if (SYNC_DEBUG) console.error("Error from runSync", error);
      await sync.checkForListenersMaybeAdd();
    });
  },

  /**
   * If you don't have the listeners, then add them.
   * Them is the onChangeListener and contextualIdentityListeners.
   */
  async checkForListenersMaybeAdd() {
    const hasStorageListener =  
      await browser.storage.onChanged.hasListener(
        sync.storageArea.onChangedListener
      );

    const hasCIListener = await sync.hasContextualIdentityListeners();

    if (!hasCIListener) {
      await sync.addContextualIdentityListeners();
    }

    if (!hasStorageListener) {
      await browser.storage.onChanged.addListener(
        sync.storageArea.onChangedListener);
    }
  },

  /**
   * If you have the listeners, then remove them.
   * Them is the onChangeListener and contextualIdentityListeners
   */
  async checkForListenersMaybeRemove() {
    const hasStorageListener =  
      await browser.storage.onChanged.hasListener(
        sync.storageArea.onChangedListener
      );

    const hasCIListener = await sync.hasContextualIdentityListeners();
            
    if (hasCIListener) {
      await sync.removeContextualIdentityListeners();
    }

    if (hasStorageListener) {
      await browser.storage.onChanged.removeListener(
        sync.storageArea.onChangedListener);
    }
  },

  /**
   * First it turns off sync. Then it updates sync storage to have all the most 
   * update data. It does a lot behind the scenes, refer to the functions it calls
   * for more details on what it does.
   */
  async runSync() {
    if (SYNC_DEBUG) {
      const syncInfo = await sync.storageArea.get();
      const localInfo = await browser.storage.local.get();
      const idents = await browser.contextualIdentities.query({});
      console.log("Initial State:", {syncInfo, localInfo, idents});
    }
    await sync.checkForListenersMaybeRemove();
    if (SYNC_DEBUG) console.log("runSync");

    await identityState.storageArea.upgradeData();
    await assignManager.storageArea.upgradeData();

    const hasSyncStorage = await sync.storageArea.hasSyncStorage();
    if (hasSyncStorage) await restore();

    await sync.storageArea.backup();
    await removeOldDeletedItems();
    return;
  },

  /**
   * Add contextual identity listeners.
   * When a contextual identity is created or updated, call backup on sync storage.
   * When a contextual identity is removed, call addToDeletedList on sync storage.
   */
  async addContextualIdentityListeners() {
    await browser.contextualIdentities.onCreated.addListener(sync.storageArea.backup);
    await browser.contextualIdentities.onRemoved.addListener(sync.storageArea.addToDeletedList);
    await browser.contextualIdentities.onUpdated.addListener(sync.storageArea.backup);
  },

  /**
   * Remove contextual identity listeners.
   */
  async removeContextualIdentityListeners() {
    await browser.contextualIdentities.onCreated.removeListener(sync.storageArea.backup);
    await browser.contextualIdentities.onRemoved.removeListener(sync.storageArea.addToDeletedList);
    await browser.contextualIdentities.onUpdated.removeListener(sync.storageArea.backup);
  },

  /**
   * Check if contextual identity listeners are set.
   */
  async hasContextualIdentityListeners() {
    return (
      await browser.contextualIdentities.onCreated.hasListener(sync.storageArea.backup) &&
      await browser.contextualIdentities.onRemoved.hasListener(sync.storageArea.addToDeletedList) &&
      await browser.contextualIdentities.onUpdated.hasListener(sync.storageArea.backup)
    );
  },

  /**
   * If sync is enabled run the error handled sync. Else if sync is not enabled
   * remove the listeners and remove this instance from sync.
   */
  async resetSync() {
    const syncEnabled = await assignManager.storageArea.getSyncEnabled();
    if (syncEnabled) {
      this.errorHandledRunSync();
      return;
    }
    await this.checkForListenersMaybeRemove();
    await this.storageArea.removeThisInstanceFromSync();
  }

};

// attaching to window for use in mocha tests
window.sync = sync;

// Initialize sync by adding listeners or removing them based on if sync is enabled
sync.init();

/**
 * Wrapper to call functions that will ensure local storage is using the most
 * up to date data from sync storage.
 */
async function restore() {
  if (SYNC_DEBUG) console.log("restore");
  await reconcileIdentities();
  await reconcileSiteAssignments();
  return;
}

/*
 * Checks for the container name. If it exists, they are assumed to be the
 * same container, and the color and icon are overwritten from sync, if
 * different.
 * 
 * First remove all contextualIdentites that were labelled as deleted in sync storage
 * but not yet deleted in local storage. Next, remove any duplicate identities in
 * sync storage. Finally, if sync storage has an identity that matches the one on
 * the local storage, update it with the most up to date information from sync storage.
 */
async function reconcileIdentities(){
  if (SYNC_DEBUG) console.log("reconcileIdentities");

  // first delete any from the deleted list
  const deletedIdentityList =
    await sync.storageArea.getDeletedIdentityList();
  // first remove any deleted identities
  for (const deletedUUID of deletedIdentityList) {
    const deletedCookieStoreId = 
      await identityState.lookupCookieStoreId(deletedUUID);
    if (deletedCookieStoreId){
      try{
        await browser.contextualIdentities.remove(deletedCookieStoreId);
      } catch (error) {
        // if the identity we are deleting is not there, that's fine.
        console.error("Error deleting contextualIdentity", deletedCookieStoreId);
        continue;
      }
    }
  }
  const localIdentities = await browser.contextualIdentities.query({});
  const syncIdentitiesRemoveDupes = 
    await sync.storageArea.getIdentities();
  // find any local dupes created on sync storage and delete from sync storage
  for (const localIdentity of localIdentities) {
    const syncIdentitiesOfName = syncIdentitiesRemoveDupes
      .filter(identity => identity.name === localIdentity.name);
    if (syncIdentitiesOfName.length > 1) {
      const identityMatchingContextId = syncIdentitiesOfName
        .find(identity => identity.cookieStoreId === localIdentity.cookieStoreId);
      if (identityMatchingContextId) 
        await sync.storageArea.removeIdentityKeyFromSync(identityMatchingContextId.macAddonUUID);
    }
  }
  const syncIdentities = 
    await sync.storageArea.getIdentities();
  // now compare all containers for matching names.
  for (const syncIdentity of syncIdentities) {
    if (syncIdentity.macAddonUUID){
      const localMatch = localIdentities.find(
        localIdentity => localIdentity.name === syncIdentity.name
      );
      if (!localMatch) {
        // if there's no name match found, check on uuid,
        const localCookieStoreID = 
          await identityState.lookupCookieStoreId(syncIdentity.macAddonUUID);
        if (localCookieStoreID) {
          await ifUUIDMatch(syncIdentity, localCookieStoreID);
          continue;
        }
        await ifNoMatch(syncIdentity);
        continue;
      }

      // Names match, so use the info from Sync
      await updateIdentityWithSyncInfo(syncIdentity, localMatch);
      continue;
    }
    // if no macAddonUUID, there is a problem with the sync info and it needs to be ignored.
  }

  await updateSiteAssignmentUUIDs();

  async function updateSiteAssignmentUUIDs(){
    const sites = assignManager.storageArea.getAssignedSites();
    for (const siteKey of Object.keys(sites)) {
      await assignManager.storageArea.set(siteKey, sites[siteKey]);
    }
  }
}

/**
 * If the local identity and sync identity do not match, update the local identity
 * with the sync information. Update the local identity uuid if it doesn't match
 * the sync identity uuid.
 * 
 * NOTE: TODO here left by developers, look into it. Maybe saying if there are any
 * site assignment UUIDs that the local identity doesn't have, get them from sync.
 */
async function updateIdentityWithSyncInfo(syncIdentity, localMatch) {
  // Sync is truth. if there is a match, compare data and update as needed
  if (syncIdentity.color !== localMatch.color 
      || syncIdentity.icon !== localMatch.icon) {
    await browser.contextualIdentities.update(
      localMatch.cookieStoreId, {
        name: syncIdentity.name, 
        color: syncIdentity.color, 
        icon: syncIdentity.icon
      });

    if (SYNC_DEBUG) {
      if (localMatch.color !== syncIdentity.color) {
        console.log(localMatch.name, "Change color: ", syncIdentity.color);
      }
      if (localMatch.icon !== syncIdentity.icon) {
        console.log(localMatch.name, "Change icon: ", syncIdentity.icon);
      }
    }
  }
  // Sync is truth. If all is the same, update the local uuid to match sync
  if (localMatch.macAddonUUID !== syncIdentity.macAddonUUID) {
    await identityState.updateUUID(
      localMatch.cookieStoreId, 
      syncIdentity.macAddonUUID
    );
  }
  // TODOkmw: update any site assignment UUIDs
}

/**
 * Update the local identity with the sync information.
 */
async function ifUUIDMatch(syncIdentity, localCookieStoreID) {
  // if there's an identical local uuid, it's the same container. Sync is truth
  const identityInfo = {
    name: syncIdentity.name,
    color: syncIdentity.color, 
    icon: syncIdentity.icon
  };
  if (SYNC_DEBUG) {
    try {
      const getIdent = 
            await browser.contextualIdentities.get(localCookieStoreID);
      if (getIdent.name !== identityInfo.name) {
        console.log(getIdent.name, "Change name: ", identityInfo.name);
      }
      if (getIdent.color !== identityInfo.color) {
        console.log(getIdent.name, "Change color: ", identityInfo.color);
      }
      if (getIdent.icon !== identityInfo.icon) {
        console.log(getIdent.name, "Change icon: ", identityInfo.icon);
      }
    } catch (error) {
      //if this fails, there is probably differing sync info.
      console.error("Error getting info on CI", error);
    }
  }
  try {
  // update the local container with the sync data
    await browser.contextualIdentities
      .update(localCookieStoreID, identityInfo);
    return;
  } catch (error) {
    // If this fails, sync info is off.
    console.error("Error udpating CI", error);
  }
}

/**
 * Crate a new identity from the sync information.
 */
async function ifNoMatch(syncIdentity){
  // if no uuid match either, make new identity
  if (SYNC_DEBUG) console.log("create new ident: ", syncIdentity.name);
  const newIdentity = 
        await browser.contextualIdentities.create({
          name: syncIdentity.name, 
          color: syncIdentity.color, 
          icon: syncIdentity.icon
        });
  await identityState.updateUUID(
    newIdentity.cookieStoreId, 
    syncIdentity.macAddonUUID
  );
  return;
}
/*
 * Checks for site previously assigned. If it exists, and has the same
 * container assignment, the assignment is kept. If it exists, but has
 * a different assignment, the user is prompted (not yet implemented).
 * If it does not exist, it is created.
 * 
 * First remove any sites from local storage that were already deleted in sync storage.
 * Next, get all synced site assignments and apply them all to local storage.
 */
async function reconcileSiteAssignments() {
  if (SYNC_DEBUG) console.log("reconcileSiteAssignments");
  const assignedSitesLocal = 
    await assignManager.storageArea.getAssignedSites();
  const assignedSitesFromSync = 
    await sync.storageArea.getAssignedSites();
  const deletedSiteList = 
    await sync.storageArea.getDeletedSiteList();
  for(const siteStoreKey of deletedSiteList) {
    if (Object.prototype.hasOwnProperty.call(assignedSitesLocal,siteStoreKey)) {
      assignManager
        .storageArea
        .remove(siteStoreKey);
    }
  }

  for(const urlKey of Object.keys(assignedSitesFromSync)) {
    const assignedSite = assignedSitesFromSync[urlKey];
    try{
      if (assignedSite.identityMacAddonUUID) {
      // Sync is truth.
      // Not even looking it up. Just overwrite
        if (SYNC_DEBUG){ 
          const isInStorage = await assignManager.storageArea.getByUrlKey(urlKey);
          if (!isInStorage)
            console.log("new assignment ", assignedSite);
        }

        await setAssignmentWithUUID(assignedSite, urlKey);
        continue;
      }
    } catch (error) {
      // this is probably old or incorrect site info in Sync
      // skip and move on.
    }
  }
}

// constant for 30 days in milliseconds
const MILISECONDS_IN_THIRTY_DAYS = 2592000000;

/**
 * First checks that if an instance has not been used in the past 30 days and therefore
 * not synced in the past 30 days, remove it from sync storage. Next, it does the following
 * 
 * For each deleted site in sync, iterate through each instance and check if any of those
 * instances has assigned that deleted site. If so, then don't do anything. However, if no 
 * instance has assigned this deleted site, 
 * 
 * TODO: This logic doesn't seem right because it is undeleting a site whenever no instances
 * assign that site anymore? It should be reversed shouldn't it?
 */
async function removeOldDeletedItems() {
  const instanceList = await sync.storageArea.getAllInstanceInfo();
  const deletedSiteList = await sync.storageArea.getDeletedSiteList();
  const deletedIdentityList = await sync.storageArea.getDeletedIdentityList();

  for (const instanceKey of Object.keys(instanceList)) {
    const date = new Date();
    const currentTimestamp = date.getTime();
    if (instanceList[instanceKey].timestamp < currentTimestamp - MILISECONDS_IN_THIRTY_DAYS) {
      delete instanceList[instanceKey];
      sync.storageArea.removeInstance(instanceKey);
      continue;
    }
  }
  for (const siteStoreKey of deletedSiteList) {
    let hasMatch = false;
    for (const instance of Object.values(instanceList)) {
      const match = instance.siteAssignments.find(element => element === siteStoreKey);
      if (!match) continue;
      hasMatch = true;
    }
    if (!hasMatch) {
      await sync.storageArea.backup({undeleteSiteStoreKey: siteStoreKey});
    }
  }
  for (const identityUUID of deletedIdentityList) {
    let hasMatch = false;
    for (const instance of Object.values(instanceList)) {
      const match = instance.identities.find(element => element === identityUUID);
      if (!match) continue;
      hasMatch = true;
    }
    if (!hasMatch) {
      await sync.storageArea.backup({undeleteUUID: identityUUID});
    }
  }
}

/**
 * Write an assigned site to local storage.
 */
async function setAssignmentWithUUID(assignedSite, urlKey) {
  const uuid = assignedSite.identityMacAddonUUID;
  const cookieStoreId = await identityState.lookupCookieStoreId(uuid);
  if (cookieStoreId) {
    // eslint-disable-next-line require-atomic-updates
    assignedSite.userContextId = cookieStoreId
      .replace(/^firefox-container-/, "");
    await assignManager.storageArea.set(
      urlKey,
      assignedSite,
      false,
      false
    );
    return;
  }
  throw new Error (`No cookieStoreId found for: ${uuid}, ${urlKey}`);
}
