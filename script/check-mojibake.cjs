const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const SOURCE_ROOTS = ["server", "client", "shared"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".html", ".css"]);
const MOJIBAKE_PATTERN = /(?:Ã.|Â.|ðŸ|â.|ï¸|Ãƒ|Â¡|Â¿)/;
const IGNORE_LINE_SNIPPETS = [
  "text.match(/(?:Ã.|Â.|ðŸ|â.|ï¸|�)/g)",
];

const findings = [];

function shouldScanFile(filename) {
  const extension = path.extname(filename).toLowerCase();
  return FILE_EXTENSIONS.has(extension);
}

function walkDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath);
      continue;
    }
    if (!entry.isFile() || !shouldScanFile(entry.name)) continue;
    const source = fs.readFileSync(fullPath, "utf8");
    const lines = source.split(/\r?\n/);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      if (IGNORE_LINE_SNIPPETS.some((snippet) => line.includes(snippet))) continue;
      if (!MOJIBAKE_PATTERN.test(line)) continue;
      findings.push({
        file: path.relative(ROOT_DIR, fullPath),
        line: lineNumber + 1,
        text: line.trim(),
      });
    }
  }
}

for (const root of SOURCE_ROOTS) {
  const fullPath = path.join(ROOT_DIR, root);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    walkDirectory(fullPath);
  }
}

if (findings.length > 0) {
  console.error(`Mojibake detected in ${findings.length} line(s):`);
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.text}`);
  }
  process.exit(1);
}

console.log("No mojibake sequences detected.");
