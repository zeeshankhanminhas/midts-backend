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

  function saveClientIntakeFiles(leadId, files) {
    if (!leadId) throw new Error('Lead ID is required for client intake files.');
    if (!Array.isArray(files) || !files.length) {
      return {
        folderUrl: '',
        fileLinks: [],
        files: []
      };
    }

    var structure = ensureLeadStructure(leadId);
    var leadFolder = DriveApp.getFolderById(structure.leadFolderId);
    var intakeFolder = getOrCreateFolder_(leadFolder, 'Client Intake Files');
    var savedFiles = [];

    files.forEach(function (file, index) {
      var name = sanitizeFilename_(file && file.name || 'intake-file-' + (index + 1));
      var contentBase64 = String(file && file.contentBase64 || '').trim();
      if (!contentBase64) return;

      var contentType = String(file && file.type || 'application/octet-stream').trim() || 'application/octet-stream';
      var bytes = Utilities.base64Decode(contentBase64);
      var blob = Utilities.newBlob(bytes, contentType, name);
      var driveFile = intakeFolder.createFile(blob);
      savedFiles.push({
        name: name,
        type: contentType,
        sizeBytes: Number(file && file.sizeBytes || bytes.length),
        driveFileId: driveFile.getId(),
        driveUrl: driveFile.getUrl()
      });
    });

    return {
      folderUrl: intakeFolder.getUrl(),
      fileLinks: savedFiles.map(function (file) { return file.driveUrl; }),
      files: savedFiles
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

  function sanitizeFilename_(name) {
    var cleaned = String(name || 'intake-file').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
    return cleaned || 'intake-file';
  }

  return {
    ensureLeadStructure: ensureLeadStructure,
    saveClientIntakeFiles: saveClientIntakeFiles,
    getQuotesFolder: getQuotesFolder,
    getVendorSafeFolder: getVendorSafeFolder
  };
})();