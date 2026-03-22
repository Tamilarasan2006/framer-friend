const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const root = path.resolve(__dirname, '..');
const sourceLogo = path.join(root, 'image', 'logo.jpeg');
const resourcesDir = path.join(root, 'cordova-app', 'resources');
const iconOut = path.join(resourcesDir, 'icon.png');
const splashOut = path.join(resourcesDir, 'splash.png');

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

async function createIcon(logo) {
    const size = 1024;
    const canvas = new Jimp(size, size, '#FFFFFF');

    const logoIcon = logo.clone();
    logoIcon.contain(760, 760, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);

    canvas.composite(logoIcon, (size - logoIcon.bitmap.width) / 2, (size - logoIcon.bitmap.height) / 2);
    await canvas.writeAsync(iconOut);
}

async function createSplash(logo) {
    const width = 2732;
    const height = 2732;
    const canvas = new Jimp(width, height, '#F6FBF4');

    const logoSplash = logo.clone();
    logoSplash.contain(1300, 1300, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);

    canvas.composite(
        logoSplash,
        Math.floor((width - logoSplash.bitmap.width) / 2),
        Math.floor((height - logoSplash.bitmap.height) / 2)
    );

    await canvas.writeAsync(splashOut);
}

async function run() {
    if (!fs.existsSync(sourceLogo)) {
        throw new Error(`Source logo not found at ${sourceLogo}`);
    }

    ensureDir(resourcesDir);

    const logo = await Jimp.read(sourceLogo);
    await createIcon(logo);
    await createSplash(logo);

    console.log('Generated Cordova source assets:');
    console.log(`- ${iconOut}`);
    console.log(`- ${splashOut}`);
}

run().catch((err) => {
    console.error('Failed to generate Cordova assets:', err.message);
    process.exit(1);
});
