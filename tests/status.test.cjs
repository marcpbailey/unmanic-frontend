const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Vue = require('vue');
const { renderToString } = require('@vue/server-renderer');
const { parse, compileScript } = require('@vue/compiler-sfc');
const root = path.resolve(__dirname, '..');

async function progress() {
  const source = fs.readFileSync(path.join(root, 'src/js/workerProgress.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

test('unknown progress remains distinct from a measured zero and retains elapsed time', async () => {
  const { workerProgress } = await progress();
  for (const percent of ['', null, undefined, 'invalid']) {
    const status = workerProgress({ percent, elapsed: '12' });
    assert.equal(status.known, false);
    assert.equal(status.hasElapsed, true);
    assert.equal(status.elapsed, 12);
  }
  assert.equal(workerProgress({ percent: '0' }).known, true);
  assert.equal(workerProgress({ percent: '75' }).percent, 75);
  assert.equal(workerProgress({ percent: '75', progress_scope: 'phase' }).phase, true);
});

test('completion status renders the active plugin, measured units and elapsed time', async () => {
  const source = fs.readFileSync(path.join(root, 'src/components/dashboard/pending/ScanCompletionStatus.vue'), 'utf8');
  const { descriptor } = parse(source);
  let code = compileScript(descriptor, { id: 'status-test', inlineTemplate: true }).content;
  code = code.replace(/import\s*\{([^}]+)\}\s*from\s*['"]vue['"];?/g,
    (_, names) => 'const {' + names.replace(/\s+as\s+/g, ': ') + '} = Vue;');
  code = code.replace('export default', 'return');
  const component = new Function('Vue', code)(Vue);
  const translations = JSON.parse(fs.readFileSync(path.join(root, 'src/language/en.json'), 'utf8'));
  assert.ok(translations.components.workers.phaseProgress.includes('{percent}'));
  const app = Vue.createSSRApp(component, { completion: { plugin_name: 'Example plugin', message: 'Checking media',
    current: 2, total: 8, unit: 'files', elapsed_seconds: 12 } });
  app.config.globalProperties.$t = (key, params = {}) => key.split('.').reduce((value, part) => value[part], translations)
    .replace(/\{([^}]+)\}/g, (_, name) => params[name]);
  for (const name of ['q-spinner', 'q-linear-progress']) app.component(name, { render: () => Vue.h('span') });
  const html = await renderToString(app);
  for (const text of ['Completing scan', 'Example plugin', 'Checking media', '2/8 files', 'Elapsed: 12s']) assert.ok(html.includes(text), text);
});

test('dashboard maps API phase and unknown progress without misleading task estimates', async () => {
  const { workerProgress } = await progress();
  const { parse: parseJavaScript } = require('@babel/parser');
  const source = fs.readFileSync(path.join(root, 'src/pages/MainDashboard.vue'), 'utf8');
  const { descriptor } = parse(source);
  const script = descriptor.script.content;
  const ast = parseJavaScript(script, { sourceType: 'module' });
  const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
  const setup = component.properties.find(node => node.key?.name === 'setup');
  const fn = setup.body.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'updateWorkerProgressCharts');
  const values = { value: {} };
  const update = new Function('workerProgress', 'dateTools', '$t', 'workerGroupColours', 'workerProgressList',
    'return (' + script.slice(fn.start, fn.end) + ')')(workerProgress,
      { printDateTimeString: String, printSecondsAsDuration: String },
      (key, params) => params ? key + ':' + params.percent : key, {}, values);
  const worker = { id: 1, name: 'Example', idle: false, paused: false, start_time: Date.now() / 1000,
    runners_info: {}, current_command: 'Checking files', subprocess: { percent: '', elapsed: 12 } };
  update([worker]);
  assert.equal(values.value['worker-1'].indeterminate, true);
  assert.equal(values.value['worker-1'].elapsed, '12');
  worker.subprocess = { percent: '25', elapsed: 12, progress_scope: 'phase' };
  update([worker]);
  assert.equal(values.value['worker-1'].indeterminate, false);
  assert.equal(values.value['worker-1'].progressText, 'components.workers.phaseProgress:25');
  assert.equal(values.value['worker-1'].etc, '...');
  worker.subprocess.progress_scope = 'task';
  update([worker]);
  assert.equal(values.value['worker-1'].etc, '36');
});
