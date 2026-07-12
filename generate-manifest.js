const { readdir, writeFile } = require('node:fs/promises');
const { join, relative, sep } = require('node:path');

const ROOT = __dirname;
const IMAGE_DIR = join(ROOT, 'images');

async function collectWebp(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectWebp(fullPath);
    return /\.webp$/i.test(entry.name) ? [fullPath] : [];
  }));
  return paths.flat();
}

async function main() {
  const images = (await collectWebp(IMAGE_DIR))
    .map((path) => relative(ROOT, path).split(sep).join('/'))
    .sort((a, b) => a.localeCompare(b, 'pl'));

  const manifest = { generatedAt: new Date().toISOString(), count: images.length, images };
  await writeFile(join(ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Zapisano manifest.json: ${images.length} obrazów.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
