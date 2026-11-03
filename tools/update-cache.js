// Met à jour sw.js avant chaque mise en ligne :
// - la version du cache, calculée à partir du contenu de tous les fichiers de l'appli ;
// - la liste des fichiers gardés hors ligne.
// Usage : node tools/update-cache.js   (ou bun tools/update-cache.js)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const SKIP = new Set(["sw.js", "node_modules", ".git", "tools"]);
const EXT = [".html", ".js", ".css", ".json", ".ttf", ".png"];

function listFiles(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) listFiles(full, out);
    else if (EXT.includes(path.extname(name))) out.push(path.relative(root, full).split(path.sep).join("/"));
  }
  return out;
}

const files = listFiles(root, []).sort();
const hash = crypto.createHash("sha256");
files.forEach((f) => hash.update(f).update(fs.readFileSync(path.join(root, f))));
const version = "mon-coin-magique-" + hash.digest("hex").slice(0, 12);

const swPath = path.join(root, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");
sw = sw.replace(/const CACHE = "[^"]*";/, 'const CACHE = "' + version + '";');
const shell = ["./", ...files.filter((f) => f !== "index.html").map((f) => "./" + f), "./index.html"];
const block =
  "// BEGIN SHELL (généré par tools/update-cache.js)\nconst SHELL = [\n" +
  shell.map((f) => '  "' + f + '",').join("\n") +
  "\n];\n// END SHELL";
sw = sw.replace(/\/\/ BEGIN SHELL[\s\S]*?\/\/ END SHELL/, block);
fs.writeFileSync(swPath, sw);
console.log("cache " + version + " — " + files.length + " fichiers");
