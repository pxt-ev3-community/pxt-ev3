#!/bin/bash

set -e
set -x

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

# Copy static document files
mkdir -p $OUTDIR/docs/static
cp -R docs/static/. $OUTDIR/docs/static/

# Patch cdnUrl
find "$OUTDIR" -type f \( -name '*.html' -o -name '*.json' -o -name '*.webmanifest' \) -print0 | while IFS= read -r -d '' f
do
    sed -i "s#@cdnUrl@/blob/[a-z0-9]*/#$URL/docs/#g" "$f" || true
    sed -i "s#@cdnUrl@#$URL#g" "$f" || true
done

if [ x$URL != x ]
then
    # Fix relative paths in tutorials
    find "$OUTDIR/docs" -type f \( -name '*.html' -o -name '*.md' \) -print0 | while IFS= read -r -d '' f
    do
        sed -i "s#\"/docs#\"$URL/docs#g" "$f" || true
        sed -i "s#\"/tutorials#\"$URL/tutorials#g" "$f" || true
    done
fi

# Fix relative paths in download screen
sed -i "s#\"/static/#\"$URL/docs/static/#g" "$OUTDIR/editor.js" || true

# Add custom .js and .css overrides
cp -R static-files/* $OUTDIR
for file in $OUTDIR/*.html
do sed -i '/<\/head>/e cat static-files/ev3-community.html' $file
done


