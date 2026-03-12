const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const includeJob = args.includes('--with-job');
const filteredArgs = args.filter(
  (arg) => !['--force', '-f', '--with-job'].includes(arg)
);
const [type, rawName] = filteredArgs;

if (!type || !rawName) {
  console.error(
    'Usage: node scripts/scaffold.js <job|route|service|ui|collection|atra-route|all> <name> [--force] [--with-job]'
  );
  process.exit(1);
}

const workspaceRoot = path.resolve(__dirname, '..');
const scaffoldsDir = path.join(workspaceRoot, 'scaffolds');

const toKebab = (value) => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
};

const toPascal = (value) => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\s-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
};

const toCamel = (value) => {
  const pascal = toPascal(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const nameKebab = toKebab(rawName);
const namePascal = toPascal(rawName);
const nameCamel = toCamel(rawName);

const templates = {
  job: {
    targets: [
      {
        template: path.join(scaffoldsDir, 'job', 'job.template.js'),
        target: path.join(
          workspaceRoot,
          'play-with-dreams',
          'jobs',
          `${nameKebab}.js`
        )
      }
    ]
  },
  route: {
    targets: [
      {
        template: path.join(scaffoldsDir, 'route', 'route.template.js'),
        target: path.join(
          workspaceRoot,
          'play-with-dreams',
          'routes',
          `${nameKebab}.routes.js`
        )
      }
    ]
  },
  service: {
    targets: [
      {
        template: path.join(scaffoldsDir, 'service', 'service.template.js'),
        target: path.join(
          workspaceRoot,
          'play-with-dreams',
          'services',
          `${nameKebab}.js`
        )
      }
    ]
  },
  ui: {
    targets: [
      {
        template: path.join(scaffoldsDir, 'ui', 'page.template.html'),
        target: path.join(
          workspaceRoot,
          'play-with-dreams',
          'client',
          `${nameKebab}.html`
        )
      },
      {
        template: path.join(scaffoldsDir, 'ui', 'page.template.css'),
        target: path.join(
          workspaceRoot,
          'play-with-dreams',
          'client',
          `${nameKebab}.css`
        )
      },
      {
        template: path.join(scaffoldsDir, 'ui', 'page.template.js'),
        target: path.join(
          workspaceRoot,
          'play-with-dreams',
          'client',
          `${nameKebab}.js`
        )
      }
    ]
  },
  collection: {
    targets: [
      {
        template: path.join(scaffoldsDir, 'collection', 'collection.template.js'),
        target: path.join(
          workspaceRoot,
          'play-with-dreams',
          'services',
          'database',
          `${nameKebab}.collection.js`
        )
      }
    ]
  },
  'atra-route': {
    targets: [
      {
        template: path.join(scaffoldsDir, 'atra-route', 'page.template.html'),
        target: path.join(
          workspaceRoot,
          'atra',
          'frontend',
          'pages',
          nameKebab,
          `${nameKebab}.html`
        )
      },
      {
        template: path.join(scaffoldsDir, 'atra-route', 'page.template.css'),
        target: path.join(
          workspaceRoot,
          'atra',
          'frontend',
          'pages',
          nameKebab,
          `${nameKebab}.css`
        )
      },
      {
        template: path.join(scaffoldsDir, 'atra-route', 'page.template.js'),
        target: path.join(
          workspaceRoot,
          'atra',
          'frontend',
          'pages',
          nameKebab,
          `${nameKebab}.js`
        )
      }
    ]
  }
};

const replaceTemplate = (content) => {
  return content
    .replace(/__NAME_KEBAB__/g, nameKebab)
    .replace(/__NAME_PASCAL__/g, namePascal)
    .replace(/__NAME_CAMEL__/g, nameCamel)
    .replace(/__NAME__/g, rawName);
};

const runScaffold = (scaffoldType) => {
  const config = templates[scaffoldType];
  if (!config) {
    console.error(`Unknown scaffold type: ${scaffoldType}`);
    process.exit(1);
  }

  config.targets.forEach(({ template, target }) => {
    const templateContent = fs.readFileSync(template, 'utf8');
    const outputContent = replaceTemplate(templateContent);

    const existed = fs.existsSync(target);
    if (existed && !force) {
      console.error(`Target already exists: ${target}`);
      process.exit(1);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, outputContent, 'utf8');
    console.log(
      `${existed && force ? 'Updated' : 'Created'} ${path.relative(
        workspaceRoot,
        target
      )}`
    );
  });

  if (scaffoldType === 'job') {
  const jobsIndexPath = path.join(
    workspaceRoot,
    'play-with-dreams',
    'jobs',
    'index.js'
  );
  const jobsIndex = fs.readFileSync(jobsIndexPath, 'utf8');
  const importLine = `import { run${namePascal} } from './${nameKebab}.js';`;
  let updated = jobsIndex;
  if (!jobsIndex.includes(importLine)) {
    const lastImportIndex = jobsIndex.lastIndexOf('import ');
    const insertPos = jobsIndex.indexOf('\n', lastImportIndex);
    updated =
      jobsIndex.slice(0, insertPos + 1) +
      importLine +
      '\n' +
      jobsIndex.slice(insertPos + 1);
  }
  const runLine = `  await run${namePascal}();`;
  if (!updated.includes(runLine)) {
    updated = updated.replace(
      "  console.log('All jobs done 🎉');",
      `${runLine}\n  console.log('All jobs done 🎉');`
    );
  }
    if (updated !== jobsIndex) {
      fs.writeFileSync(jobsIndexPath, updated, 'utf8');
      console.log('Updated play-with-dreams/jobs/index.js');
    }
  }

  if (scaffoldType === 'route') {
  const serverPath = path.join(workspaceRoot, 'play-with-dreams', 'server.js');
  const serverSource = fs.readFileSync(serverPath, 'utf8');
  const importLine = `import ${nameCamel}Router from './routes/${nameKebab}.routes.js';`;
  let updated = serverSource;
  if (!serverSource.includes(importLine)) {
    const lastImportIndex = serverSource.lastIndexOf('import ');
    const insertPos = serverSource.indexOf('\n', lastImportIndex);
    updated =
      serverSource.slice(0, insertPos + 1) +
      importLine +
      '\n' +
      serverSource.slice(insertPos + 1);
  }

  const useLine = `app.use('/${nameKebab}', ${nameCamel}Router);`;
  if (!updated.includes(useLine)) {
    updated = updated.replace(
      "app.use('/study', studyRouter);",
      `app.use('/study', studyRouter);\n${useLine}`
    );
  }

    if (updated !== serverSource) {
      fs.writeFileSync(serverPath, updated, 'utf8');
      console.log('Updated play-with-dreams/server.js');
    }
  }

  if (scaffoldType === 'ui') {
  const serverPath = path.join(workspaceRoot, 'play-with-dreams', 'server.js');
  const serverSource = fs.readFileSync(serverPath, 'utf8');
  const newRoute = `app.get('/${nameKebab}', (req, res) => {\n  res.sendFile('client/${nameKebab}.html', { root: process.cwd() });\n});`;

  if (!serverSource.includes(newRoute)) {
    const addDreamRegex = /app\.get\('\/add-dream'[\s\S]*?\n\}\);\r?\n/;
    const updated = serverSource.replace(
      addDreamRegex,
      (match) => `${match}\n${newRoute}\n`
    );

      if (updated !== serverSource) {
        fs.writeFileSync(serverPath, updated, 'utf8');
        console.log('Updated play-with-dreams/server.js');
      }
    }
  }

  if (scaffoldType === 'collection') {
  const datastorePath = path.join(
    workspaceRoot,
    'play-with-dreams',
    'services',
    'database',
    'datastore.js'
  );
  const datastoreSource = fs.readFileSync(datastorePath, 'utf8');
  const newLine = `    this.${nameCamel} = new DataStoreCollection(db, '${nameKebab}');`;

  if (!datastoreSource.includes(newLine)) {
    const lines = datastoreSource.split('\n');
    let insertAfter = -1;
    lines.forEach((line, index) => {
      if (line.includes('new DataStoreCollection')) {
        insertAfter = index;
      }
    });

      if (insertAfter !== -1) {
        lines.splice(insertAfter + 1, 0, newLine);
        fs.writeFileSync(datastorePath, lines.join('\n'), 'utf8');
        console.log('Updated play-with-dreams/services/database/datastore.js');
      }
    }
  }

  if (scaffoldType === 'atra-route') {
  const routingPath = path.join(workspaceRoot, 'atra', 'server.routing.js');
  const routingSource = fs.readFileSync(routingPath, 'utf8');
  const routeBlock = `app.get('/:locale/${nameKebab}', async (req, res) => {\n  const strings = await locales.get(req.params.locale);\n  res.render('pages/${nameKebab}/${nameKebab}', {\n    ...strings.lang,\n    title: '${namePascal}',\n    description: 'TODO: describe ${nameKebab} page'\n  });\n})\n\n`;

  if (!routingSource.includes(routeBlock)) {
    const updated = routingSource.replace(
      "app.get('/:locale/', async (req, res) => {",
      `${routeBlock}app.get('/:locale/', async (req, res) => {`
    );

      if (updated !== routingSource) {
        fs.writeFileSync(routingPath, updated, 'utf8');
        console.log('Updated atra/server.routing.js');
      }
    }
  }
};

const typesToRun =
  type === 'all'
    ? [
        ...(includeJob ? ['job'] : []),
        'route',
        'service',
        'ui',
        'collection',
        'atra-route'
      ]
    : [type];

typesToRun.forEach((scaffoldType) => runScaffold(scaffoldType));