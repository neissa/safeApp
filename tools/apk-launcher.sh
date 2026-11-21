#!/usr/bin/env bash
# Transforme l'APK généré par PWABuilder en appli d'accueil Android (launcher).
#
# Mode d'emploi (Git Bash, depuis la racine du dépôt) :
#   bash tools/apk-launcher.sh ["chemin/vers/Mon coin - Google Play package.zip"]
#
# Ce que fait le script :
#   1. extrait l'APK et la clé de signature de l'archive PWABuilder dans un dossier temporaire ;
#   2. ouvre l'APK avec apktool (téléchargé une fois dans ~/.cache/apktool) ;
#   3. ajoute à l'activité de lancement les catégories HOME et DEFAULT (une seule fois) ;
#   4. augmente le numéro de version (versionCode) ;
#   5. reconstruit, aligne et signe avec la MÊME clé (l'appli se met à jour sans être désinstallée) ;
#   6. vérifie le certificat et le manifeste, puis remplace apk/Mon coin.apk.
#
# Les mots de passe sont lus dans signing-key-info.txt de l'archive, ou dans les variables
# KS_PASS et KEY_PASS, ou demandés au clavier. Ils ne sont jamais écrits sur le disque.
# Variables facultatives : JAVA_HOME, ANDROID_SDK, KEY_ALIAS, VERSION_CODE.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="${1:-$HOME/Downloads/Mon coin - Google Play package.zip}"
OUT_APK="$REPO/apk/Mon coin.apk"

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

# ---------- 2. Catégorie HOME (idempotent) ----------
if grep -q 'android.intent.category.HOME' "$MANIFEST"; then
  echo "Le manifeste déclare déjà HOME."
else
  # Après l'intent-filter qui contient LAUNCHER, on ajoute un second intent-filter MAIN + HOME + DEFAULT.
  awk '
    /android.intent.category.LAUNCHER/ { seen = 1 }
    { print }
    seen && /<\/intent-filter>/ {
      match($0, /^[ \t]*/); ind = substr($0, 1, RLENGTH)
      print ind "<intent-filter>"
      print ind "    <action android:name=\"android.intent.action.MAIN\"/>"
      print ind "    <category android:name=\"android.intent.category.HOME\"/>"
      print ind "    <category android:name=\"android.intent.category.DEFAULT\"/>"
      print ind "</intent-filter>"
      seen = 0; done = 1
    }
    END { if (!done) exit 3 }
  ' "$MANIFEST" > "$MANIFEST.new" || fail "activité LAUNCHER introuvable dans le manifeste"
  mv "$MANIFEST.new" "$MANIFEST"
  echo "Catégorie HOME ajoutée."
fi

# ---------- 3. Numéro de version ----------
code_of() { "$AAPT2" dump badging "$1" 2>/dev/null | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p" | head -1; }
SRC_CODE="$(code_of "$SRC_APK")"
CUR_CODE="$( [ -f "$OUT_APK" ] && code_of "$OUT_APK" || echo 0 )"
BASE=$(( SRC_CODE > CUR_CODE ? SRC_CODE : CUR_CODE ))
NEW_CODE="${VERSION_CODE:-$(( BASE + 1 ))}"
# apktool.yml : « versionCode: 1 » ou « versionCode: '1' »
sed -i -E "s/(versionCode:[[:space:]]*'?)[0-9]+/\1$NEW_CODE/" "$WORK/dec/apktool.yml"
grep -q "versionCode:.*$NEW_CODE" "$WORK/dec/apktool.yml" || fail "versionCode non trouvé dans apktool.yml"
echo "versionCode : $SRC_CODE (PWABuilder) / $CUR_CODE (dépôt) -> $NEW_CODE"

# ---------- 4. Reconstruction, alignement, signature ----------
echo "Reconstruction…"
java -jar "$APKTOOL_JAR" b -q -o "$WORK/unsigned.apk" "$WORK/dec"
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
[ "$(code_of "$WORK/signed.apk")" = "$NEW_CODE" ] || fail "versionCode final inattendu"

# ---------- 6. Remplacement ----------
cp "$WORK/signed.apk" "$OUT_APK"
echo "OK : $OUT_APK ($(wc -c < "$OUT_APK") octets, versionCode $NEW_CODE, launcher)"
