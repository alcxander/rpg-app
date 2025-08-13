// scan-exports.js
import fs from "fs";
import path from "path";

// Paths (adjust if needed)
const componentsDir = path.resolve("./components");
const pageFile = path.resolve("./app/page.tsx");

function getExports(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const hasDefault = /export\s+default\s+/m.test(content);
  const namedMatches = [...content.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g)];
  const namedExports = namedMatches.map(m => m[1]);
  return { hasDefault, namedExports };
}

// Get imports from page.tsx
const pageContent = fs.readFileSync(pageFile, "utf8");
const importMatches = [...pageContent.matchAll(/import\s+(.*?)\s+from\s+["']@\/components\/(.*?)["']/g)];

const results = [];

for (const match of importMatches) {
  const imported = match[1].trim();
  const fileBase = match[2].replace(/\.[jt]sx?$/, "");
  const filePath = path.join(componentsDir, fileBase + ".tsx");

  if (fs.existsSync(filePath)) {
    const { hasDefault, namedExports } = getExports(filePath);
    results.push({
      file: fileBase + ".tsx",
      imported,
      hasDefault,
      namedExports
    });
  } else {
    results.push({
      file: fileBase + ".tsx",
      error: "File not found"
    });
  }
}

// Output
console.log("Component Export Scan Results:");
results.forEach(r => {
  if (r.error) {
    console.log(`❌ ${r.file} — ${r.error}`);
  } else if (!r.hasDefault) {
    console.log(`⚠ ${r.file} — No default export (named: ${r.namedExports.join(", ")})`);
  } else {
    console.log(`✅ ${r.file} — Default export present`);
  }
});
