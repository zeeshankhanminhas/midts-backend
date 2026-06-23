var MidtsVendorSafePackageService = (function () {
  function preparePackage(leadId, reviewer) {
    return { ok: false, code: 'NOT_IMPLEMENTED', message: 'Vendor-safe package preparation is pending.' };
  }

  return { preparePackage: preparePackage };
})();
