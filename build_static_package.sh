#!/bin/bash

set -e
set -x

export MSYS_NO_PATHCONV=1

# This script builds a static package for hosting pxt-ev3 editor.
# The URL path can be given as argument if not at root of site.
URL=$(echo $1 | sed -E 's|/+$||' | sed -E '/^$/! s|^([^/])|/\1|')

PXT=$(which pxt || echo node_modules/pxt/pxt)
if ! [ -e $PXT ]
then npm install pxt
fi

# Run pxt site generator
$PXT staticpkg --locs-src translations --route "$URL/"
OUTDIR=built/packaged$URL

# Copy static document files to both /docs/static and /static so both relative and /docs/-prefixed paths work
mkdir -p $OUTDIR/docs/static $OUTDIR/static
if [ -d node_modules/pxt-core/common-docs/static ]; then
    cp -R node_modules/pxt-core/common-docs/static/. $OUTDIR/docs/static/
    cp -R node_modules/pxt-core/common-docs/static/. $OUTDIR/static/
fi
cp -R docs/static/. $OUTDIR/docs/static/
cp -R docs/static/. $OUTDIR/static/

# Patch cdnUrl
find "$OUTDIR" -type f \( -name '*.html' -o -name '*.json' -o -name '*.webmanifest' \) -print0 | while IFS= read -r -d '' f
do
    sed -i "s#@cdnUrl@/blob/[a-z0-9]*/#$URL/docs/#g" "$f" || true
    sed -i "s#@cdnUrl@#$URL#g" "$f" || true
done

if [ x$URL != x ]
then
    # Fix relative paths in docs, tutorials, static assets and scripts
    find "$OUTDIR" -type f \( -name '*.html' -o -name '*.md' -o -name '*.js' -o -name '*.json' \) -print0 | while IFS= read -r -d '' f
    do
        sed -i -E "s#([\"'])/static/#\1$URL/static/#g" "$f" || true
        sed -i -E "s#([\"'])/docs/static/#\1$URL/docs/static/#g" "$f" || true
        sed -i -E "s#([\"'])/docfiles/#\1$URL/docfiles/#g" "$f" || true
        sed -i -E "s#([\"'])/docs/#\1$URL/docs/#g" "$f" || true
        sed -i -E "s#([\"'])/tutorials/#\1$URL/tutorials/#g" "$f" || true
    done
fi

# Fix relative favicon paths in docs/*.html
DOC_FAVICON_PREFIX="${URL:-}/docs/static/"
find "$OUTDIR/docs" -type f -name '*.html' -print0 2>/dev/null | while IFS= read -r -d '' f
do
    sed -i "s#href=\"docs/static/#href=\"${DOC_FAVICON_PREFIX}#g" "$f" || true
done

# Fix relative paths in download screen
sed -i "s#\"/static/#\"$URL/docs/static/#g" "$OUTDIR/editor.js" || true

# Fix extension card package icons in target.json, target.js, editor.js and main.js
sed -i -E "s#\"(\\./|/)?static/packages/#\"$URL/docs/static/packages/#g" "$OUTDIR/target.json" "$OUTDIR/target.js" "$OUTDIR/editor.js" "$OUTDIR/main.js" 2>/dev/null || true

# Revert docMenu items in target.json and target.js from /docs/... to /... so side docs and popouts do not double /docs
sed -i -E 's#"path":\s*"('$URL')?/docs/(reference|troubleshoot)"#"path": "/\2"#g' "$OUTDIR/target.json" "$OUTDIR/target.js" 2>/dev/null || true

# Fix side docs popout in all packaged JS files so it includes targetUrl and does not produce /docs/docs/
node -e '
const fs = require("fs");
const path = require("path");
const targetUrl = (process.argv[1] || "").replace(/\/+$/, "");
const outdir = process.argv[2];
if (fs.existsSync(outdir)) {
    for (const file of fs.readdirSync(outdir)) {
        if (!file.endsWith(".js")) continue;
        const filePath = path.join(outdir, file);
        let content = fs.readFileSync(filePath, "utf8");
        const replaced = content.replace(
            /`\/docs\$\{([a-zA-Z0-9_$]+)\[4\]\}\.html`/g,
            "`" + targetUrl + "/docs/${$1[4].replace(/^(\\/?docs)?\\//, \"\")}.html`"
        );
        if (replaced !== content) {
            console.log("Patched popout docs URL in " + file);
            fs.writeFileSync(filePath, replaced, "utf8");
        }
    }
}
' "$URL" "$OUTDIR" 2>/dev/null || true

# Fix any accidental /docs/docs/ in rendered html, js and json files
find "$OUTDIR" -type f \( -name '*.html' -o -name '*.js' -o -name '*.json' \) -print0 | while IFS= read -r -d '' f
do
    sed -i "s#/docs/docs/#/docs/#g" "$f" || true
done

# Add custom .js and .css overrides
cp -R static-files/* $OUTDIR
for file in $OUTDIR/*.html
do sed -i '/<\/head>/e cat static-files/ev3-community.html' $file
done



