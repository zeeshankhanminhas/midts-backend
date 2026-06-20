var MidtsDriveService = (function () {
  function ensureLeadStructure(leadId) {
    if (!leadId) throw new Error('Lead ID is required for Drive folder setup.');

    var root = getRootFolder_();
    var leadFolder = getOrCreateFolder_(root, 'Lead_' + leadId);
    var vendorSafeFolder = getOrCreateFolder_(leadFolder, 'Vendor Safe');
    var quotesFolder = getOrCreateFolder_(leadFolder, 'Quotes');

    return {
      leadFolderId: leadFolder.getId(),
      leadFolderUrl: leadFolder.getUrl(),
      vendorSafeFolderId: vendorSafeFolder.getId(),
      vendorSafeFolderUrl: vendorSafeFolder.getUrl(),
      quotesFolderId: quotesFolder.getId(),
      quotesFolderUrl: quotesFolder.getUrl()
    };
  }

  function getQuotesFolder(leadId) {
    var structure = ensureLeadStructure(leadId);
    return DriveApp.getFolderById(structure.quotesFolderId);
  }

  function getVendorSafeFolder(leadId) {
    var structure = ensureLeadStructure(leadId);
    return DriveApp.getFolderById(structure.vendorSafeFolderId);
  }

  function getRootFolder_() {
    var rootId = MidtsConfig.getRequiredScriptProperty('DRIVE_ROOT_FOLDER_ID');
    return DriveApp.getFolderById(rootId);
  }

  function getOrCreateFolder_(parent, name) {
    var matches = parent.getFoldersByName(name);
    return matches.hasNext() ? matches.next() : parent.createFolder(name);
  }

  return {
    ensureLeadStructure: ensureLeadStructure,
    getQuotesFolder: getQuotesFolder,
    getVendorSafeFolder: getVendorSafeFolder
  };
})();