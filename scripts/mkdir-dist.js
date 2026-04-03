const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "dist");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}
