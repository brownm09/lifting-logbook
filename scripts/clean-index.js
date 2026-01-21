const { glob } = require("glob");
const fs = require("fs");

glob("dist/**/index.js")
  .then((files) => {
    files.forEach((file) => {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        console.error("Error deleting file:", file, e);
      }
    });
  })
  .catch((err) => {
    console.error("Glob error:", err);
    process.exit(1);
  });
