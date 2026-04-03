const { glob } = require("glob");
const fs = require("fs");
const path = require("path");

// Move all .js files to dist/
const files = glob.sync("dist/**/*.js");
files.forEach((file) => {
  const dest = path.join("dist", path.basename(file));
  if (file !== dest) {
    fs.copyFileSync(file, dest);
    fs.unlinkSync(file);
  }
});

// Recursively remove empty directories in dist/
function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeEmptyDirs(fullPath);
    }
  });
  // After removing subdirs, check if current dir is empty (and not root dist)
  if (dir !== path.resolve("dist") && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

removeEmptyDirs(path.resolve("dist"));
