/* Build: node build.js [path to _chat.txt]
   Merges the hand-written report with chat stats and inlines everything into docs/index.html
   (the folder GitHub Pages serves). With a chat path, stats are recomputed and cached in
   src/muskan-stats.json; without one, the cached stats are used, so the raw chat isn't needed. */
const fs = require('fs'), path = require('path');
const Analyzer = require('./src/analyzer.js');
const report = require('./src/report-muskan.js');

// The analyst persona. Change this one word to rename the whole site.
const PERSONA = 'Bunty';

const cache = path.join(__dirname, 'src', 'muskan-stats.json');
const chatPath = process.argv[2];
let stats;
if (chatPath) {
  stats = Analyzer.analyze(Analyzer.parse(fs.readFileSync(chatPath, 'utf8')));
  // Signature words can echo codes or names from the raw chat; the hand-written report doesn't use them.
  stats.people.forEach(p => { p.signature = []; });
  fs.writeFileSync(cache, JSON.stringify(stats, null, 1));
} else if (fs.existsSync(cache)) {
  stats = JSON.parse(fs.readFileSync(cache, 'utf8'));
} else {
  console.error('No cached stats yet. Run once with: node build.js <_chat.txt>'); process.exit(1);
}

const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const json = JSON.stringify([{ ...report, stats }]).replace(/</g, '\\u003c');
const html = src('template.html')
  .replace('/*STYLES*/', () => src('styles.css'))
  .replace('/*DATA*/', () => json)
  .replace('/*ANALYZER*/', () => src('analyzer.js'))
  .replace('/*WRITER*/', () => src('writer.js'))
  .replace('/*APP*/', () => src('app.js'))
  .replace(/Brandon/g, PERSONA)
  .replace(/brandon\.reports/g, PERSONA.toLowerCase() + '.reports');

fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'docs', 'index.html'), html);
console.log(`docs/index.html written (${(html.length / 1024).toFixed(0)} KB, ${stats.total} messages, persona "${PERSONA}")`);
