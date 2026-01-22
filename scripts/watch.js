const esbuild = require("esbuild");
const { exec } = require("child_process");
const { globSync } = require("glob");
const path = require("path");

// 1. Find all entry points
const entryPoints = globSync("src/{core,api}/*/index.ts");

async function watch() {
  // Create a build context for each entry point
  const contexts = await Promise.all(
    entryPoints.map((entry) => {
      const folderName = path.basename(path.dirname(entry));

      return esbuild.context({
        entryPoints: [entry],
        bundle: true,
        outfile: `dist/${folderName}.js`,
        format: "iife",
        globalName: folderName.replace(/-/g, "_"),
        banner: { js: "var exports = {};" },
        plugins: [
          {
            name: "on-end",
            setup(build) {
              build.onEnd((result) => {
                if (result.errors.length === 0) {
                  console.log(`✅ Built ${folderName}`);
                  // 2. Trigger Clasp Push after build
                  exec("clasp push", (err, stdout) => {
                    if (err) console.error(`❌ Clasp Error: ${err}`);
                    else console.log("🚀 Pushed to Google Apps Script");
                  });
                }
              });
            },
          },
        ],
      });
    }),
  );

  // 3. Start watching
  for (const ctx of contexts) {
    await ctx.watch();
  }

  console.log("👀 Watching for changes...");
}

watch();
