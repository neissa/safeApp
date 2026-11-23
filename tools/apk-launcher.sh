#!/usr/bin/env bash
# Transforme l'APK généré par PWABuilder en appli d'accueil Android (launcher).
#
# Mode d'emploi (Git Bash, depuis la racine du dépôt) :
#   bash tools/apk-launcher.sh ["chemin/vers/Mon coin - Google Play package.zip"]
#
# Ce que fait le script :
#   1. extrait l'APK et la clé de signature de l'archive PWABuilder dans un dossier temporaire ;
#   2. ouvre l'APK avec apktool (téléchargé une fois dans ~/.cache/apktool) ;
#   3. ajoute une activité « écran d'accueil » (tools/apk-launcher/HomeActivity.java, compilée avec
#      javac et d8) qui reste ouverte et relance l'appli à chaque appui sur Accueil ;
#   4. augmente le numéro de version (versionCode) ;
#   5. reconstruit, aligne et signe avec la MÊME clé (l'appli se met à jour sans être désinstallée) ;
#   6. vérifie le certificat et le manifeste, puis écrit une COPIE : apk/Mon coin launcher.apk
#      (apk/Mon coin.apk reste tel quel).
#
# Les deux APK ont le même nom de paquet et la même clé : installer la copie launcher met à jour
# l'appli déjà installée (sans perdre les données) et lui ajoute le rôle d'écran d'accueil.
#
# Les mots de passe sont lus dans signing-key-info.txt de l'archive, ou dans les variables
# KS_PASS et KEY_PASS, ou demandés au clavier. Ils ne sont jamais écrits sur le disque.
# Variables facultatives : JAVA_HOME, ANDROID_SDK, KEY_ALIAS, VERSION_CODE.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="${1:-$HOME/Downloads/Mon coin - Google Play package.zip}"
BASE_APK="$REPO/apk/Mon coin.apk" # APK actuel, jamais modifié
OUT_APK="${OUT_APK:-$REPO/apk/Mon coin launcher.apk}" # copie launcher

JAVA_HOME="${JAVA_HOME:-/c/Program Files/Android/Android Studio/jbr}"
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"
ANDROID_SDK="${ANDROID_SDK:-${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk}"
BT="$(ls -d "$ANDROID_SDK"/build-tools/* | sort -V | tail -1)"
APKSIGNER="$BT/apksigner"; [ -f "$APKSIGNER.bat" ] && APKSIGNER="$APKSIGNER.bat"
ZIPALIGN="$BT/zipalign"; [ -f "$ZIPALIGN.exe" ] && ZIPALIGN="$ZIPALIGN.exe"
AAPT2="$BT/aapt2"; [ -f "$AAPT2.exe" ] && AAPT2="$AAPT2.exe"

APKTOOL_VERSION="3.0.3"
APKTOOL_JAR="$HOME/.cache/apktool/apktool_$APKTOOL_VERSION.jar"

fail() { echo "ERREUR : $*" >&2; exit 1; }

[ -f "$ZIP" ] || fail "archive PWABuilder introuvable : $ZIP"
command -v java >/dev/null || fail "java introuvable (régler JAVA_HOME)"
[ -d "$BT" ] || fail "build-tools Android introuvables dans $ANDROID_SDK"

# ---------- apktool ----------
if [ ! -f "$APKTOOL_JAR" ]; then
  echo "Téléchargement d'apktool $APKTOOL_VERSION…"
  mkdir -p "$(dirname "$APKTOOL_JAR")"
  curl -fsSL -o "$APKTOOL_JAR" \
    "https://github.com/iBotPeaches/Apktool/releases/download/v$APKTOOL_VERSION/apktool_$APKTOOL_VERSION.jar"
fi

# ---------- Dossier de travail (effacé à la fin) ----------
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
unzip -q -o "$ZIP" -d "$WORK/pkg"
SRC_APK="$(ls "$WORK"/pkg/*.apk | head -1)"
KEYSTORE="$WORK/pkg/signing.keystore"
INFO="$WORK/pkg/signing-key-info.txt"
[ -f "$SRC_APK" ] || fail "pas d'APK dans l'archive"
[ -f "$KEYSTORE" ] || fail "pas de signing.keystore dans l'archive"

# ---------- Alias et mots de passe ----------
# Lit la valeur après « <libellé> : » dans signing-key-info.txt (format PWABuilder).
info_value() { [ -f "$INFO" ] && grep -i -m1 "^$1" "$INFO" | sed 's/^[^:]*:[[:space:]]*//; s/\r$//' || true; }
KEY_ALIAS="${KEY_ALIAS:-$(info_value 'Key alias')}"
KS_PASS="${KS_PASS:-$(info_value 'Key store password')}"
KEY_PASS="${KEY_PASS:-$(info_value 'Key password')}"
[ -n "$KEY_ALIAS" ] || read -r -p "Alias de la clé : " KEY_ALIAS
[ -n "$KS_PASS" ] || { read -r -s -p "Mot de passe du keystore : " KS_PASS; echo; }
[ -n "$KEY_PASS" ] || KEY_PASS="$KS_PASS"
export KS_PASS KEY_PASS

# ---------- 1. Décodage ----------
echo "Ouverture de l'APK…"
java -jar "$APKTOOL_JAR" d -f -q -o "$WORK/dec" "$SRC_APK"
MANIFEST="$WORK/dec/AndroidManifest.xml"

# ---------- 2. Activité « écran d'accueil » (idempotent) ----------
# L'activité de lancement de la TWA lance Chrome puis se ferme : elle ne peut pas être l'écran d'accueil.
# On ajoute HomeActivity (tools/apk-launcher/HomeActivity.java), qui reste ouverte sous l'appli et la
# relance à chaque appui sur Accueil (singleTask : l'appli repart sur ses tuiles).
grep -q '<application' "$MANIFEST" || fail "balise <application> introuvable dans le manifeste"
if grep -q 'HomeActivity' "$MANIFEST"; then
  echo "Le manifeste déclare déjà HomeActivity."
else
  awk '
    /<\/application>/ && !done {
      print "        <activity android:name=\"io.github.neissa.twa.HomeActivity\" android:exported=\"true\""
      print "            android:launchMode=\"singleTask\" android:excludeFromRecents=\"true\""
      print "            android:taskAffinity=\"io.github.neissa.twa.home\""
      print "            android:stateNotNeeded=\"true\" android:theme=\"@android:style/Theme.Material.Light.NoActionBar\">"
      print "            <intent-filter>"
      print "                <action android:name=\"android.intent.action.MAIN\"/>"
      print "                <category android:name=\"android.intent.category.HOME\"/>"
      print "                <category android:name=\"android.intent.category.DEFAULT\"/>"
      print "            </intent-filter>"
      print "        </activity>"
      done = 1
    }
    { print }
    END { if (!done) exit 3 }
  ' "$MANIFEST" > "$MANIFEST.new" || fail "fin de <application> introuvable dans le manifeste"
  mv "$MANIFEST.new" "$MANIFEST"
  echo "HomeActivity déclarée."
fi

# Compilation de HomeActivity en dex (javac + d8), ajouté à l'APK après la reconstruction
ANDROID_JAR="$(ls -d "$ANDROID_SDK"/platforms/android-* | sort -V | tail -1)/android.jar"
[ -f "$ANDROID_JAR" ] || fail "android.jar introuvable dans $ANDROID_SDK/platforms"
D8="$BT/d8"; [ -f "$D8.bat" ] && D8="$D8.bat"
mkdir -p "$WORK/home/classes" "$WORK/home/dex"
javac -nowarn -encoding UTF-8 --release 11 -cp "$ANDROID_JAR" -d "$WORK/home/classes" "$REPO/tools/apk-launcher/HomeActivity.java" 2>/dev/null \
  || javac -nowarn -encoding UTF-8 -source 11 -target 11 -cp "$ANDROID_JAR" -d "$WORK/home/classes" "$REPO/tools/apk-launcher/HomeActivity.java"
"$D8" --release --min-api 21 --lib "$ANDROID_JAR" --output "$WORK/home/dex" "$WORK/home/classes/io/github/neissa/twa/HomeActivity.class"
# Numéro du nouveau fichier dex : après ceux de l'APK (smali, smali_classes2, …)
DEX_N=$(( $(ls -d "$WORK/dec"/smali* | wc -l) + 1 ))
mv "$WORK/home/dex/classes.dex" "$WORK/home/dex/classes$DEX_N.dex"
echo "HomeActivity compilée (classes$DEX_N.dex)."

# ---------- 3. Numéro de version ----------
code_of() { "$AAPT2" dump badging "$1" 2>/dev/null | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p" | head -1; }
SRC_CODE="$(code_of "$SRC_APK")"
# Le numéro doit dépasser celui de l'APK actuel et celui d'une copie launcher déjà faite
CUR_CODE=0
for f in "$BASE_APK" "$OUT_APK"; do
  if [ -f "$f" ]; then c="$(code_of "$f")"; [ -n "$c" ] && [ "$c" -gt "$CUR_CODE" ] && CUR_CODE="$c"; fi
done
BASE=$(( SRC_CODE > CUR_CODE ? SRC_CODE : CUR_CODE ))
NEW_CODE="${VERSION_CODE:-$(( BASE + 1 ))}"
# apktool.yml : « versionCode: 1 » ou « versionCode: '1' »
sed -i -E "s/(versionCode:[[:space:]]*'?)[0-9]+/\1$NEW_CODE/" "$WORK/dec/apktool.yml"
grep -q "versionCode:.*$NEW_CODE" "$WORK/dec/apktool.yml" || fail "versionCode non trouvé dans apktool.yml"
echo "versionCode : $SRC_CODE (PWABuilder) / $CUR_CODE (dépôt) -> $NEW_CODE"

# ---------- 4. Reconstruction, alignement, signature ----------
echo "Reconstruction…"
java -jar "$APKTOOL_JAR" b -q -o "$WORK/unsigned.apk" "$WORK/dec"
( cd "$WORK/home/dex" && jar ufM "$WORK/unsigned.apk" "classes$DEX_N.dex" )
"$ZIPALIGN" -p -f 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
  --ks-pass env:KS_PASS --key-pass env:KEY_PASS \
  --out "$WORK/signed.apk" "$WORK/aligned.apk"

# ---------- 5. Vérifications ----------
cert_of() { "$APKSIGNER" verify --print-certs "$1" | grep -m1 'SHA-256' | sed 's/.*: //'; }
OLD_CERT="$(cert_of "$SRC_APK")"
NEW_CERT="$(cert_of "$WORK/signed.apk")"
echo "Certificat d'origine : $OLD_CERT"
echo "Nouveau certificat   : $NEW_CERT"
[ -n "$NEW_CERT" ] && [ "$OLD_CERT" = "$NEW_CERT" ] || fail "certificats différents : l'APK ne pourrait pas remplacer l'appli installée"
"$AAPT2" dump xmltree --file AndroidManifest.xml "$WORK/signed.apk" | grep -q 'android.intent.category.HOME' \
  || fail "HOME absent du manifeste final"
unzip -l "$WORK/signed.apk" | grep -q "classes$DEX_N.dex" || fail "HomeActivity absente de l'APK final"
[ "$(code_of "$WORK/signed.apk")" = "$NEW_CODE" ] || fail "versionCode final inattendu"

# ---------- 6. Copie launcher (l'APK actuel n'est pas touché) ----------
cp "$WORK/signed.apk" "$OUT_APK"
echo "OK : $OUT_APK ($(wc -c < "$OUT_APK") octets, versionCode $NEW_CODE, launcher)"
