const esbuild = require("esbuild");
const { globSync } = require("glob");
const fs = require("fs");
const path = require("path");

const entryPoints = globSync("src/{core,api}/index.ts");
// console.log("Building entry points:", entryPoints);

entryPoints.forEach((entry) => {
  const folderName = path.basename(path.dirname(entry));

  esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: `dist/${folderName}.js`,
    format: "iife",
    globalName: folderName.replace(/-/g, "_"),
    banner: { js: "var exports = {};" },
  });
});

// Copy appsscript.json from src to dist
const manifestSrc = path.join(__dirname, "src", "appsscript.json");
const manifestDest = path.join(__dirname, "dist", "appsscript.json");
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
}

const mainSrc = path.join(__dirname, "src", "main.js");
const mainDest = path.join(__dirname, "dist", "main.js");
if (fs.existsSync(mainSrc)) {
  fs.copyFileSync(mainSrc, mainDest);
}

/*
// build.js: Remove all 'export' statements from transpiled JS for Apps Script compatibility

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

*/
