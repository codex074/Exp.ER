const SPREADSHEET_ID = '1-K36cIiTAbxQE3Pocr5O0x5_ymNFMBQrJl_uTZ8bBcE';

/**
 * Handle GET requests (Read Data)
 */
function doGet(e) {
  const action = e.parameter.action;
  let result = {};
  
  try {
    if (action === 'getDrugList') {
      result = getDrugList();
    } else if (action === 'getReportData') {
      result = getReportData();
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests (Write Data)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload;
    let result = {};

    if (action === 'saveData') {
      result = saveData(payload);
    } else if (action === 'deleteItem') {
      result = deleteItem(payload.rowIndex, payload.note);
    } else if (action === 'manageItem') {
      result = manageItem(payload.rowIndex, payload.manageQty, payload.newAction, payload.newDetails, payload.newNotes);
    } else if (action === 'updateStockQuantity') {
      result = updateStockQuantity(payload.rowIndex, payload.newQty);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- Logic Functions (เหมือนเดิม) ---

function getDrugList() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('list');
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
  return data.map(row => ({
    drugName: row[0], generic: row[1], strength: row[2], unit: row[3], displayName: `${row[0]} - ${row[2]}`
  })).filter(item => item.drugName !== "");
}

function logActionToSheet(ss, drugName, qty, action, details) {
  const logSheetName = 'action.log';
  let sheet = ss.getSheetByName(logSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(logSheetName);
    const header = ['Timestamp', 'Drug Name', 'Quantity Managed', 'Action Type', 'Details'];
    sheet.appendRow(header);
  } else if (sheet.getLastRow() === 0) {
    const header = ['Timestamp', 'Drug Name', 'Quantity Managed', 'Action Type', 'Details'];
    sheet.appendRow(header);
  }
  sheet.appendRow([new Date(), drugName, "'" + qty, action, details]);
}

function saveData(formObject) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('data');
  if (!sheet) sheet = ss.insertSheet('data');
  if (sheet.getLastRow() === 0) {
    const header = ['Timestamp', 'Drug Name', 'Generic', 'Strength', 'Quantity', 'Unit', 'Expiry Date', 'Action', 'Sub-details', 'Notes'];
    sheet.appendRow(header);
  }

  const rowData = [
    new Date(), formObject.drugName, formObject.generic, formObject.strength, "'" + formObject.qty, formObject.unit,
    formObject.expiryDate, formObject.actionType, formObject.subDetails || "", formObject.notes || ""
  ];
  sheet.appendRow(rowData);

  const detailLog = (formObject.subDetails || "") + " " + (formObject.notes || "");
  logActionToSheet(ss, formObject.drugName, formObject.qty, "New Entry (" + formObject.actionType + ")", detailLog.trim());

  return { success: true, message: "Saved successfully!" };
}

function getReportData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('data');
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  const data = sheet.getRange(2, 1, lastRow - 1, 10).getDisplayValues();

  return data.map((row, i) => ({
    rowIndex: i + 2, 
    drugName: row[1], 
    strength: row[3], 
    qty: parseInt(row[4]) || 0, 
    unit: row[5],
    expiryDate: row[6], 
    action: row[7], 
    subDetails: row[8],
    notes: row[9] 
  })).filter(item => item.drugName && item.drugName !== "");
}

function deleteItem(rowIndex, note) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('data');
  const idx = parseInt(rowIndex);
  const rowData = sheet.getRange(idx, 1, 1, 10).getDisplayValues()[0];
  logActionToSheet(ss, rowData[1], rowData[4], "Deleted", `User deleted. Reason: ${note || '-'}`);
  sheet.deleteRow(idx);
  return { success: true, message: "Deleted successfully" };
}

function manageItem(rowIndex, manageQty, newAction, newDetails, newNotes) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('data');
  const idx = parseInt(rowIndex);
  const range = sheet.getRange(idx, 1, 1, 10);
  const originalData = range.getValues()[0];
  
  const currentQty = parseInt(originalData[4]) || 0;
  const reqQty = parseInt(manageQty);
  const drugName = originalData[1];

  if (reqQty <= 0) return { success: false, message: "Quantity must be > 0" };
  if (reqQty > currentQty) return { success: false, message: "Not enough stock" };

  const detailLog = `${newDetails} ${newNotes}`.trim();
  logActionToSheet(ss, drugName, reqQty, newAction, detailLog);

  if (reqQty === currentQty) {
      sheet.getRange(idx, 8).setValue(newAction);
      sheet.getRange(idx, 9).setValue(newDetails);
      sheet.getRange(idx, 10).setValue(newNotes);
      return { success: true, message: "Updated all items successfully" };
  } else {
      const remainQty = currentQty - reqQty;
      sheet.getRange(idx, 5).setValue("'" + remainQty);
      
      const newRow = [...originalData];
      newRow[0] = new Date();
      newRow[4] = "'" + reqQty;
      newRow[7] = newAction;
      newRow[8] = newDetails;
      newRow[9] = newNotes;

      if (originalData[6] instanceof Date) {
        newRow[6] = Utilities.formatDate(originalData[6], ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
      }

      sheet.appendRow(newRow);
      return { success: true, message: `Split ${reqQty} items successfully` };
  }
}

function updateStockQuantity(rowIndex, newQty) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('data');
  const idx = parseInt(rowIndex);
  const oldQty = sheet.getRange(idx, 5).getValue();
  const drugName = sheet.getRange(idx, 2).getValue();
  logActionToSheet(ss, drugName, newQty, "Stock Correction", `Adjusted from ${oldQty} to ${newQty}`);
  sheet.getRange(idx, 5).setValue("'" + newQty);
  return { success: true, message: "Stock adjusted successfully" };
}