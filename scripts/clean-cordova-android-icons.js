const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const resRoot = path.join(root, 'cordova-app', 'platforms', 'android', 'app', 'src', 'main', 'res');

function removeLegacyJpegLaunchers() {
    if (!fs.existsSync(resRoot)) {
        console.log('Android platform resources not found yet, skipping JPEG icon cleanup.');
        return;
    }

    const dirs = fs.readdirSync(resRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith('mipmap-'))
        .map((d) => path.join(resRoot, d.name));

    let removed = 0;

    for (const dir of dirs) {
        const jpegPath = path.join(dir, 'ic_launcher.jpeg');
        if (fs.existsSync(jpegPath)) {
            fs.rmSync(jpegPath, { force: true });
            removed += 1;
        }
    }

    if (removed > 0) {
        console.log(`Removed ${removed} legacy JPEG launcher icon(s).`);
    } else {
        console.log('No legacy JPEG launcher icons found.');
    }
}

removeLegacyJpegLaunchers();
