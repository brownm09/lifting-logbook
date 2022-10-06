/**
 *  Print exception message to screen
 *
 *  @param {Error} err
 *  @param {String} msg
 *
 */
function handleException(err, msg) {
  const range = err.range;
  var errStr, errLocation;
  if (range === undefined || range === null) {
    errStr = `Error: ${err}\n${msg}\n${err.stack}`
  } else {
    errLocation = range.getA1Notation();
    errStr = `Error at ${errLocation}: ${err}\n${msg}\n${err.stack}`
  }
  Logger.log(errStr);
  try {
    SpreadsheetApp.getUi().alert(errStr);
  } catch(err) {
    Logger.log(`Could not display error on UI: ${err}`)
  }
}