#!/usr/bin/env node

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = process.cwd();

function getGitInfo() {
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const shortSha = sha.slice(0, 8);
    const dirtyFiles = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8' }).trim();
    const dirty = dirtyFiles.length > 0;
    return { sha, shortSha, dirty };
  } catch {
    return { sha: 'unknown', shortSha: 'unknown', dirty: false };
  }
}
const SOURCE_DIRS = [
  'packages/server/src',
  'packages/client/src',
  'packages/shared/src',
];
const MIGRATIONS_DIR = 'packages/server/src/db/migrations';
const OUTPUT_DIR = '.claude/cache';
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'codebase-map.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'codebase-map.md');

const args = new Set(process.argv.slice(2));
const writeFiles = !args.has('--stdout');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dirPath, exts) {
  const out = [];
  if (!await exists(dirPath)) return out;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(fullPath, exts));
      continue;
    }
    const ext = path.extname(entry.name);
    if (exts.has(ext)) out.push(fullPath);
  }
  return out;
}

function toRel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function lineOfIndex(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

function joinRoute(prefix, routePath) {
  if (!prefix) return routePath;
  if (routePath === '/') return prefix;
  return `${prefix.replace(/\/$/, '')}/${routePath.replace(/^\//, '')}`;
}

function topN(items, n, valueKey) {
  return [...items]
    .sort((a, b) => (b[valueKey] ?? 0) - (a[valueKey] ?? 0))
    .slice(0, n);
}

function parseRegisterPrefixes(appTsContent) {
  const registerPrefixes = new Map();
  const registerRegex = /app\.register\((\w+),\s*\{\s*prefix:\s*['"]([^'"]+)['"]\s*\}\)/g;
  let match;
  while ((match = registerRegex.exec(appTsContent)) !== null) {
    registerPrefixes.set(match[1], match[2]);
  }
  return registerPrefixes;
}

function extractRoutePluginName(routeFileContent) {
  const match = routeFileContent.match(/export const (\w+)\s*:/);
  return match ? match[1] : null;
}

function extractRoutes(content, fileRel, prefix) {
  const routeRegex = /app\.(get|post|patch|delete|put|options|head)\s*(?:<[^>]+>)?\(\s*(['"`])([^'"`]+)\2/g;
  const out = [];
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[3];
    const fullPath = joinRoute(prefix, routePath);
    out.push({
      method,
      path: fullPath,
      file: fileRel,
      line: lineOfIndex(content, match.index),
    });
  }
  return out;
}

function extractSseEvents(content, fileRel) {
  const out = [];

  const emitRegex = /emitEvent\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = emitRegex.exec(content)) !== null) {
    out.push({
      event: match[1],
      file: fileRel,
      line: lineOfIndex(content, match.index),
    });
  }

  const typeRegex = /type:\s*['"`]([^'"`]+)['"`]/g;
  while ((match = typeRegex.exec(content)) !== null) {
    out.push({
      event: match[1],
      file: fileRel,
      line: lineOfIndex(content, match.index),
    });
  }

  const sendEventRegex = /sendEvent\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = sendEventRegex.exec(content)) !== null) {
    out.push({
      event: match[1],
      file: fileRel,
      line: lineOfIndex(content, match.index),
    });
  }

  return out;
}

function extractSqlTables(content, fileRel) {
  const tableRegex = /CREATE TABLE(?: IF NOT EXISTS)?\s+([a-zA-Z_][\w]*)/gi;
  const out = [];
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    out.push({
      table: match[1],
      file: fileRel,
      line: lineOfIndex(content, match.index),
    });
  }
  return out;
}

function extractImports(content) {
  const imports = [];
  const importRegex = /^\s*import\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function extractExports(content) {
  const exports = new Set();
  const namedRegex = /export\s+(?:async\s+)?(?:class|function|const|let|var|type|interface|enum)\s+([A-Za-z_]\w*)/g;
  let match;
  while ((match = namedRegex.exec(content)) !== null) {
    exports.add(match[1]);
  }

  const listRegex = /export\s*\{([^}]+)\}/g;
  while ((match = listRegex.exec(content)) !== null) {
    const names = match[1]
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => {
        const parts = v.split(/\s+as\s+/i);
        return (parts[1] || parts[0]).trim();
      });
    for (const name of names) exports.add(name);
  }

  if (/export\s+default\b/.test(content)) {
    exports.add('default');
  }

  return [...exports];
}

function buildImportResolver(tsFileSet) {
  function stripJsExt(p) {
    // ESM TypeScript projects import .js but the source is .ts
    if (p.endsWith('.js')) return p.slice(0, -3);
    if (p.endsWith('.mjs')) return p.slice(0, -4);
    return p;
  }

  function resolveTsLike(baseAbs) {
    const stripped = stripJsExt(baseAbs);
    const candidates = [
      baseAbs,
      `${stripped}.ts`,
      `${stripped}.tsx`,
      `${stripped}.js`,
      `${stripped}.mjs`,
      path.join(stripped, 'index.ts'),
      path.join(stripped, 'index.tsx'),
      path.join(stripped, 'index.js'),
      path.join(stripped, 'index.mjs'),
    ];
    for (const c of candidates) {
      if (tsFileSet.has(c)) return c;
    }
    return null;
  }

  return (fromAbs, spec) => {
    if (spec.startsWith('.')) {
      return resolveTsLike(path.resolve(path.dirname(fromAbs), spec));
    }

    if (spec === '@scsd/shared') {
      return resolveTsLike(path.join(ROOT, 'packages/shared/src/index'));
    }

    if (spec.startsWith('@scsd/shared/')) {
      const suffix = spec.slice('@scsd/shared/'.length);
      return resolveTsLike(path.join(ROOT, 'packages/shared/src', suffix));
    }

    return null;
  };
}

function makeMarkdown(map) {
  const lines = [];
  lines.push('# Codebase Map');
  lines.push('');
  lines.push(`Generated: ${map.generatedAt}`);
  lines.push(`Git: ${map.gitShortSha}${map.gitDirty ? ' (dirty)' : ''}`);
  lines.push('');
  lines.push('## Snapshot');
  lines.push(`- Files scanned: ${map.summary.filesScanned}`);
  lines.push(`- TypeScript files: ${map.summary.tsFiles}`);
  lines.push(`- Total lines: ${map.summary.totalLines}`);
  lines.push(`- Internal import edges: ${map.summary.internalImportEdges}`);
  lines.push('');
  lines.push('## Package Breakdown');
  for (const pkg of map.packageBreakdown) {
    lines.push(`- ${pkg.package}: ${pkg.files} files, ${pkg.lines} lines`);
  }
  lines.push('');
  lines.push('## Entry Points');
  for (const ep of map.entryPoints) {
    lines.push(`- ${ep}`);
  }
  lines.push('');
  lines.push('## Suggested Triage Read Order');
  for (const item of map.suggestedReadOrder) {
    lines.push(`1. ${item}`);
  }
  lines.push('');
  lines.push('## API Routes');
  lines.push('| Method | Path | Source |');
  lines.push('|---|---|---|');
  for (const route of map.routes) {
    lines.push(`| ${route.method} | \`${route.path}\` | \`${route.file}:${route.line}\` |`);
  }
  lines.push('');
  lines.push('## SSE Events');
  for (const ev of map.sseEvents) {
    const refs = ev.locations.map((l) => `\`${l.file}:${l.line}\``).join(', ');
    lines.push(`- \`${ev.event}\`: ${refs}`);
  }
  lines.push('');
  lines.push('## Database Tables');
  for (const table of map.dbTables) {
    lines.push(`- \`${table.table}\` from \`${table.file}:${table.line}\``);
  }
  lines.push('');
  lines.push('## Hotspots');
  lines.push('### Most Referenced (fan-in)');
  for (const f of map.hotspots.mostReferencedFiles) {
    lines.push(`- \`${f.file}\`: ${f.referencedBy} references`);
  }
  lines.push('');
  lines.push('### Largest Files');
  for (const f of map.hotspots.largestFiles) {
    lines.push(`- \`${f.file}\`: ${f.lines} lines`);
  }
  lines.push('');
  lines.push('### Highest Fan-out');
  for (const f of map.hotspots.highestFanOutFiles) {
    lines.push(`- \`${f.file}\`: ${f.imports} internal imports`);
  }
  lines.push('');
  lines.push('### Top External Imports');
  for (const dep of map.hotspots.topExternalImports) {
    lines.push(`- \`${dep.specifier}\`: ${dep.count}`);
  }
  lines.push('');
  lines.push('## Fast Triage Commands');
  lines.push('```bash');
  lines.push('npm run triage:map');
  lines.push("rg -n \"TODO|FIXME|HACK\" packages");
  lines.push("rg -n \"app\\.(get|post|patch|delete|put)\\(\" packages/server/src/routes");
  lines.push("rg -n \"track:|search:|download:|sync:\" packages/server/src");
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const sourceFiles = [];
  const codeExts = new Set(['.ts', '.tsx', '.html', '.scss']);
  for (const relDir of SOURCE_DIRS) {
    const absDir = path.join(ROOT, relDir);
    sourceFiles.push(...await walk(absDir, codeExts));
  }

  const migrationFiles = await walk(path.join(ROOT, MIGRATIONS_DIR), new Set(['.sql']));
  const allFiles = [...sourceFiles, ...migrationFiles];
  allFiles.sort();

  const tsFiles = allFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  const tsFileSet = new Set(tsFiles);
  const resolveImport = buildImportResolver(tsFileSet);

  const fileMeta = [];
  const internalEdgeSet = new Set();
  const reverseEdges = new Map();
  const externalImportCounts = new Map();

  const routes = [];
  const sseRaw = [];
  const dbTables = [];

  const appTsPath = path.join(ROOT, 'packages/server/src/app.ts');
  const appTsContent = await exists(appTsPath)
    ? await fs.readFile(appTsPath, 'utf8')
    : '';
  const registerPrefixes = parseRegisterPrefixes(appTsContent);

  for (const absPath of allFiles) {
    const relPath = toRel(absPath);
    const content = await fs.readFile(absPath, 'utf8');
    const lines = content === '' ? 0 : content.split('\n').length;
    const size = Buffer.byteLength(content, 'utf8');
    const isTs = absPath.endsWith('.ts') || absPath.endsWith('.tsx');

    const meta = {
      file: relPath,
      lines,
      sizeBytes: size,
      imports: 0,
      exports: [],
    };

    if (isTs) {
      const imports = extractImports(content);
      const exports = extractExports(content);

      const internalImports = new Set();
      for (const spec of imports) {
        const resolved = resolveImport(absPath, spec);
        if (resolved) {
          const edge = `${relPath}->${toRel(resolved)}`;
          internalEdgeSet.add(edge);
          internalImports.add(toRel(resolved));
          reverseEdges.set(toRel(resolved), (reverseEdges.get(toRel(resolved)) || 0) + 1);
        } else {
          externalImportCounts.set(spec, (externalImportCounts.get(spec) || 0) + 1);
        }
      }

      meta.imports = internalImports.size;
      meta.exports = exports;
    }

    if (relPath.startsWith('packages/server/src/routes/') && relPath.endsWith('.ts')) {
      const pluginName = extractRoutePluginName(content);
      const prefix = pluginName ? registerPrefixes.get(pluginName) || '' : '';
      routes.push(...extractRoutes(content, relPath, prefix));
    }

    if (relPath.startsWith('packages/server/src/') && relPath.endsWith('.ts')) {
      sseRaw.push(...extractSseEvents(content, relPath));
    }

    if (relPath.startsWith(MIGRATIONS_DIR) && relPath.endsWith('.sql')) {
      dbTables.push(...extractSqlTables(content, relPath));
    }

    fileMeta.push(meta);
  }

  const sseEventMap = new Map();
  for (const ev of sseRaw) {
    if (!sseEventMap.has(ev.event)) {
      sseEventMap.set(ev.event, []);
    }
    sseEventMap.get(ev.event).push({ file: ev.file, line: ev.line });
  }

  const sseEvents = [...sseEventMap.entries()]
    .map(([event, locations]) => ({
      event,
      locations: locations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    }))
    .sort((a, b) => a.event.localeCompare(b.event));

  const packageBreakdown = [
    'packages/server/src',
    'packages/client/src',
    'packages/shared/src',
  ].map((pkg) => {
    const files = fileMeta.filter((m) => m.file.startsWith(pkg));
    return {
      package: pkg,
      files: files.length,
      lines: files.reduce((acc, f) => acc + f.lines, 0),
    };
  });

  const largestFiles = topN(
    fileMeta.map((f) => ({ file: f.file, lines: f.lines })),
    12,
    'lines',
  );
  const highestFanOutFiles = topN(
    fileMeta.map((f) => ({ file: f.file, imports: f.imports || 0 })),
    12,
    'imports',
  );
  const mostReferencedFiles = topN(
    fileMeta.map((f) => ({ file: f.file, referencedBy: reverseEdges.get(f.file) || 0 })),
    12,
    'referencedBy',
  );
  const topExternalImports = topN(
    [...externalImportCounts.entries()].map(([specifier, count]) => ({ specifier, count })),
    15,
    'count',
  );

  const defaultEntryPoints = [
    'packages/server/src/index.ts',
    'packages/server/src/app.ts',
    'packages/server/src/services/download-manager.service.ts',
    'packages/server/src/routes/tracks.routes.ts',
    'packages/client/src/app/core/services/track-state.service.ts',
    'packages/client/src/app/features/dashboard/dashboard.component.ts',
    'packages/shared/src/models/track.ts',
    'packages/shared/src/api/requests.ts',
    'packages/shared/src/api/responses.ts',
  ];
  const entryPoints = defaultEntryPoints.filter((p) => fileMeta.some((f) => f.file === p));

  const suggestedReadOrder = [
    ...entryPoints,
    ...mostReferencedFiles.map((f) => f.file),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 12);

  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const gitInfo = getGitInfo();

  const map = {
    generatedAt: new Date().toISOString(),
    gitSha: gitInfo.sha,
    gitShortSha: gitInfo.shortSha,
    gitDirty: gitInfo.dirty,
    root: ROOT,
    summary: {
      filesScanned: allFiles.length,
      tsFiles: tsFiles.length,
      totalLines: fileMeta.reduce((acc, f) => acc + f.lines, 0),
      internalImportEdges: internalEdgeSet.size,
    },
    packageBreakdown,
    entryPoints,
    suggestedReadOrder,
    routes,
    sseEvents,
    dbTables,
    hotspots: {
      mostReferencedFiles,
      largestFiles,
      highestFanOutFiles,
      topExternalImports,
    },
    files: fileMeta,
  };

  const markdown = makeMarkdown(map);

  if (writeFiles) {
    await fs.mkdir(path.join(ROOT, OUTPUT_DIR), { recursive: true });
    await fs.writeFile(path.join(ROOT, OUTPUT_JSON), JSON.stringify(map, null, 2), 'utf8');
    await fs.writeFile(path.join(ROOT, OUTPUT_MD), markdown, 'utf8');
    console.log(`Wrote ${OUTPUT_JSON}`);
    console.log(`Wrote ${OUTPUT_MD}`);
  } else {
    console.log(markdown);
  }
}

main().catch((err) => {
  console.error('triage-map failed:', err);
  process.exit(1);
});
