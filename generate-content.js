const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const ROOT = __dirname;
const SOURCE_FILE = 'content-source.json';
const REQUIRED_FIELDS = ['image', 'category', 'title', 'summary', 'text'];

async function main() {
  const content = {};
  const source = JSON.parse(await readFile(join(ROOT, SOURCE_FILE), 'utf8'));

  for (const [filename, fact] of Object.entries(source)) {
    const key = filename.toLowerCase();
    if (content[key]) throw new Error(`Kolizja ciekawostek dla obrazu: ${filename}`);
    if (REQUIRED_FIELDS.some((field) => typeof fact[field] !== 'string' || !fact[field].trim())) {
      throw new Error(`Niepełny rekord w ${SOURCE_FILE}: ${filename}`);
    }
    const extraFields = Object.keys(fact).filter((field) => !REQUIRED_FIELDS.includes(field));
    if (extraFields.length) throw new Error(`Zbędne pola w ${SOURCE_FILE} (${filename}): ${extraFields.join(', ')}`);
    if (fact.image.toLowerCase() !== key) throw new Error(`Klucz nie odpowiada polu image w ${SOURCE_FILE}: ${filename}`);
    content[key] = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, fact[field].trim()]));
  }

  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  const imageNames = new Set(manifest.images.map((path) => path.split('/').pop().toLowerCase()));
  const missingContent = [...imageNames].filter((filename) => !content[filename]);
  const orphanContent = Object.keys(content).filter((filename) => !imageNames.has(filename));
  if (missingContent.length) throw new Error(`Obrazy bez ciekawostek: ${missingContent.join(', ')}`);
  if (orphanContent.length) throw new Error(`Ciekawostki bez obrazów: ${orphanContent.join(', ')}`);

  const sortedContent = Object.fromEntries(Object.entries(content).sort(([a], [b]) => a.localeCompare(b, 'pl')));
  await writeFile(join(ROOT, 'content.json'), `${JSON.stringify(sortedContent, null, 2)}\n`, 'utf8');
  console.log(`Zapisano content.json: ${Object.keys(content).length} ciekawostek.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
