// Met à jour le projet avant chaque mise en ligne :
// - un numéro de version calculé à partir du contenu de tous les fichiers ;
// - version.json (lu par l'appli pour savoir si une mise à jour existe) ;
// - la version et la date dans index.html (affichées dans le menu parent) ;
// - la version du cache, la liste des fichiers hors ligne (sw.js) ;
// - un numéro de version sur chaque script et feuille de style de index.html (?v=…).
// Usage : bun tools/update-cache.js   (ou node tools/update-cache.js)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const SKIP = new Set(["sw.js", "node_modules", ".git", "tools"]);
const GENERATED = new Set(["version.json"]); // écrit par ce script, donc exclu du calcul
const EXT = [".html", ".js", ".css", ".json", ".ttf", ".png", ".mp3", ".ogg"];
const META = /[ \t]*<meta name="app-(?:version|built)"[^>]*>\n?/g; // lignes de version dans index.html

function listFiles(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) listFiles(full, out);
    else if (EXT.includes(path.extname(name))) out.push(path.relative(root, full).split(path.sep).join("/"));
  }
  return out;
}

// Contenu d'un fichier pour le calcul de version (sans les lignes de version de index.html)
function contentOf(f) {
  const buf = fs.readFileSync(path.join(root, f));
  return f === "index.html" ? buf.toString("utf8").replace(META, "") : buf;
}

const files = listFiles(root, []).filter((f) => !GENERATED.has(f)).sort();
const global = crypto.createHash("sha256");
files.forEach((f) => global.update(f).update(contentOf(f)));
const version = global.digest("hex").slice(0, 12);
// Date et heure locales de la mise à jour : « AAAA-MM-JJ HH:MM »
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const built = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());

fs.writeFileSync(path.join(root, "version.json"), JSON.stringify({ version, built }, null, 2) + "\n");

// index.html : version affichée, numéro de chaque script et feuille de style
const readHash = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");
const indexPath = path.join(root, "index.html");
let html = fs.readFileSync(indexPath, "utf8").replace(META, "");
html = html.replace(
  /(src|href)="((?:js|css)\/[^"?]+)(\?v=[0-9a-f]+)?"/g,
  (m, attr, file) => attr + '="' + file + "?v=" + readHash(file).slice(0, 10) + '"'
);
html = html.replace(
  '<meta name="color-scheme" content="light">',
  '<meta name="color-scheme" content="light">\n  <meta name="app-version" content="' + version + '">\n  <meta name="app-built" content="' + built + '">'
);
fs.writeFileSync(indexPath, html);

// sw.js : version du cache et liste des fichiers
const swPath = path.join(root, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");
sw = sw.replace(/const CACHE = "[^"]*";/, 'const CACHE = "mon-coin-magique-' + version + '";');
const shell = ["./", ...files.filter((f) => f !== "index.html").map((f) => "./" + f), "./index.html"];
const block =
  "// BEGIN SHELL (généré par tools/update-cache.js)\nconst SHELL = [\n" +
  shell.map((f) => '  "' + f + '",').join("\n") +
  "\n];\n// END SHELL";
sw = sw.replace(/\/\/ BEGIN SHELL[\s\S]*?\/\/ END SHELL/, block);
fs.writeFileSync(swPath, sw);

console.log("version " + version + " (" + built + ") — " + files.length + " fichiers");
