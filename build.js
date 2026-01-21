// build.js: Remove all 'export' statements from transpiled JS for Apps Script compatibility
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "dist");

function stripExports(filePath) {
  let code = fs.readFileSync(filePath, "utf8");
  // Remove ES module export statements
  code = code.replace(/^export\s+\{[^}]+};?$/gm, "");
  code = code.replace(/^export\s+(function|const|let|var|class)\s+/gm, "$1 ");
  fs.writeFileSync(filePath, code, "utf8");
}

function processDir(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith(".js")) {
      stripExports(fullPath);
    }
  });
}

processDir(SRC_DIR);

// Copy appsscript.json from src to dist
const manifestSrc = path.join(__dirname, "src", "appsscript.json");
const manifestDest = path.join(__dirname, "dist", "appsscript.json");
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
}
