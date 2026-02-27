const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

// Check if clasp is installed (global or local)
let claspInstalled = false;
let claspCheck = spawnSync("clasp --version", { stdio: "ignore", shell: true });
if (!claspCheck.error && claspCheck.status === 0) {
  claspInstalled = true;
}
if (!claspInstalled) {
  claspCheck = spawnSync("npx clasp --version", {
    stdio: "ignore",
    shell: true,
  });
  if (!claspCheck.error && claspCheck.status === 0) {
    claspInstalled = true;
  }
}
if (!claspInstalled) {
  console.error(
    'Error: "clasp" is not installed or not in PATH. Please run "npm install --save-dev @google/clasp" or install globally.',
  );
  process.exit(1);
}

const tokenPath = path.join(os.homedir(), ".clasptoken.json");
const rcPath = path.join(os.homedir(), ".clasprc.json");

function isClaspLoggedIn() {
  return fs.existsSync(tokenPath) || fs.existsSync(rcPath);
}

if (!isClaspLoggedIn()) {
  console.warn('clasp is not logged in. Attempting to run "clasp login"...');
  // Try global clasp first, then npx clasp
  let result = spawnSync("clasp login", { stdio: "inherit", shell: true });
  if (result.error || result.status !== 0) {
    result = spawnSync("npx clasp login", { stdio: "inherit", shell: true });
  }
  if (result.error || result.status !== 0) {
    console.error(
      'Failed to log in to clasp. Please run "clasp login" manually.',
    );
    process.exit(1);
  }
  // After login, check again
  if (!isClaspLoggedIn()) {
    console.error("clasp login did not complete successfully.");
    process.exit(1);
  }
}
