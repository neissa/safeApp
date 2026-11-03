// Met à jour le projet avant chaque mise en ligne :
// - la version du cache (sw.js), calculée à partir du contenu de tous les fichiers ;
// - la liste des fichiers gardés hors ligne (sw.js) ;
// - un numéro de version sur chaque script et feuille de style de index.html (?v=…),
//   pour que la page et les fichiers chargés soient toujours la même version.
// Usage : bun tools/update-cache.js   (ou node tools/update-cache.js)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const SKIP = new Set(["sw.js", "node_modules", ".git", "tools"]);
const EXT = [".html", ".js", ".css", ".json", ".ttf", ".png", ".mp3", ".ogg"];

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
const readHash = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");

// Version globale du cache
const global = crypto.createHash("sha256");
files.forEach((f) => global.update(f).update(fs.readFileSync(path.join(root, f))));
const version = "mon-coin-magique-" + global.digest("hex").slice(0, 12);

// Numéro de version de chaque script et feuille de style, dans index.html
const indexPath = path.join(root, "index.html");
const html = fs
  .readFileSync(indexPath, "utf8")
  .replace(/(src|href)="((?:js|css)\/[^"?]+)(\?v=[0-9a-f]+)?"/g, (m, attr, file) => attr + '="' + file + "?v=" + readHash(file).slice(0, 10) + '"');
fs.writeFileSync(indexPath, html);

// sw.js : version du cache et liste des fichiers
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
