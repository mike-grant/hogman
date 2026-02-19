#!/usr/bin/env bun
import { $ } from 'bun';
import { existsSync, mkdirSync } from 'fs';

const targets = [
  { platform: 'darwin', arch: 'arm64', label: 'macOS Apple Silicon' },
  { platform: 'darwin', arch: 'x64',   label: 'macOS Intel' },
  { platform: 'linux',  arch: 'arm64', label: 'Linux ARM64' },
  { platform: 'linux',  arch: 'x64',   label: 'Linux x64' },
] as const;

const outDir = 'dist-binaries';
if (!existsSync(outDir)) mkdirSync(outDir);

console.log('Building hogman binaries...\n');

let failed = false;

for (const { platform, arch, label } of targets) {
  const outFile = `${outDir}/hogman-${platform}-${arch}`;
  const target  = `bun-${platform}-${arch}`;

  process.stdout.write(`  ${label.padEnd(26)} → ${outFile} ... `);

  try {
    await $`bun build src/index.ts --compile --target=${target} --outfile=${outFile}`.quiet();
    const size = await $`du -sh ${outFile}`.text();
    console.log(`✓  (${size.split('\t')[0].trim()})`);
  } catch (err) {
    console.log('✗  FAILED');
    console.error((err as Error).message);
    failed = true;
  }
}

if (failed) {
  console.error('\nOne or more builds failed.');
  process.exit(1);
}

console.log('\nGenerating checksums...');
await $`cd ${outDir} && shasum -a 256 hogman-* > checksums.txt`.quiet();
console.log(`  Written: ${outDir}/checksums.txt`);

console.log('\nAll builds complete.\n');
await $`ls -lh ${outDir}/`.nothrow();
