#!/usr/bin/env node
'use strict';

/**
 * PDF Compressor — percentage-based target size reduction.
 *
 * Usage:
 *   node pdfcompress.js input.pdf 25
 *   node pdfcompress.js input.pdf 50 output.pdf
 *
 * Requires Ghostscript:
 *   Windows: install Ghostscript and ensure `gswin64c` is on PATH.
 *   macOS:   brew install ghostscript
 *   Ubuntu:  sudo apt install ghostscript
 *
 * The percentage is a target, not a guaranteed reduction.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const inputArg = process.argv[2];
const percentageArg = process.argv[3];
const outputArg = process.argv[4];

function usage() {
  console.log(`
PDF Compressor — reduce PDF size by a target percentage

Usage:
  node pdfcompress.js <input.pdf> <percentage> [output.pdf]

Examples:
  node pdfcompress.js document.pdf 10
  node pdfcompress.js document.pdf 25 compressed.pdf
  node pdfcompress.js document.pdf 50

Percentage must be greater than 0 and less than 100.
Ghostscript must be installed and available on PATH.
`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = units[0];

  for (let i = 1; size >= 1024 && i < units.length; i++) {
    size /= 1024;
    unit = units[i];
  }

  return `${size.toFixed(2)} ${unit}`;
}

function refersToSameFile(input, output) {
  const inputStat = fs.statSync(input);

  try {
    const outputStat = fs.statSync(output);
    if (
      inputStat.ino !== 0 &&
      inputStat.dev === outputStat.dev &&
      inputStat.ino === outputStat.ino
    ) {
      return true;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return path.relative(input, output) === '';
}

function runGhostscript(executable, args) {
  return execFileAsync(executable, args, {
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 10 * 60 * 1000
  });
}

async function findGhostscript() {
  const candidates = process.platform === 'win32'
    ? ['gswin64c', 'gswin32c', 'gs']
    : ['gs'];

  for (const executable of candidates) {
    try {
      await runGhostscript(executable, ['--version']);
      return executable;
    } catch (_) {
      // Try the next executable name.
    }
  }

  throw new Error(
    'Ghostscript was not found. Install it and add its executable to PATH.'
  );
}

function buildArgs(input, output, settings) {
  const { dpi, jpegQuality } = settings;

  return [
    '-dSAFER',
    '-dBATCH',
    '-dNOPAUSE',
    '-dQUIET',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.5',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dEmbedAllFonts=true',
    '-dAutoRotatePages=/None',

    '-dDownsampleColorImages=true',
    '-dColorImageDownsampleType=/Bicubic',
    `-dColorImageResolution=${dpi}`,

    '-dDownsampleGrayImages=true',
    '-dGrayImageDownsampleType=/Bicubic',
    `-dGrayImageResolution=${dpi}`,

    '-dDownsampleMonoImages=true',
    '-dMonoImageDownsampleType=/Subsample',
    `-dMonoImageResolution=${Math.max(150, dpi)}`,

    '-dEncodeColorImages=true',
    '-dEncodeGrayImages=true',
    '-dAutoFilterColorImages=false',
    '-dAutoFilterGrayImages=false',
    `-dJPEGQ=${jpegQuality}`,

    `-sOutputFile=${output}`,
    input
  ];
}

async function main() {
  if (!inputArg || !percentageArg) {
    usage();
    process.exitCode = 1;
    return;
  }

  const percentage = Number(percentageArg);

  if (
    !Number.isFinite(percentage) ||
    percentage <= 0 ||
    percentage >= 100
  ) {
    throw new Error('Percentage must be a number greater than 0 and less than 100.');
  }

  const input = path.resolve(inputArg);
  const output = path.resolve(
    outputArg || path.join(
      path.dirname(input),
      `${path.basename(input, path.extname(input))}.compressed.pdf`
    )
  );

  if (!fs.existsSync(input) || !fs.statSync(input).isFile()) {
    throw new Error(`Input file does not exist: ${input}`);
  }

  if (path.extname(input).toLowerCase() !== '.pdf') {
    throw new Error('Input file must have a .pdf extension.');
  }

  if (path.extname(output).toLowerCase() !== '.pdf') {
    throw new Error('Output file must have a .pdf extension.');
  }

  if (refersToSameFile(input, output)) {
    throw new Error('Input and output paths must be different.');
  }

  const originalSize = fs.statSync(input).size;
  const targetSize = originalSize * (1 - percentage / 100);
  const ghostscript = await findGhostscript();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfcompress-'));

  // Try progressively stronger image downsampling and encoding.
  const settings = [
    { dpi: 300, jpegQuality: 90 },
    { dpi: 240, jpegQuality: 85 },
    { dpi: 200, jpegQuality: 80 },
    { dpi: 150, jpegQuality: 75 },
    { dpi: 120, jpegQuality: 65 },
    { dpi: 96,  jpegQuality: 55 },
    { dpi: 72,  jpegQuality: 45 }
  ];

  const candidates = [];

  try {
    console.log(`Input:             ${input}`);
    console.log(`Original size:     ${formatBytes(originalSize)}`);
    console.log(`Requested reduction: ${percentage}%`);
    console.log(`Target output size: ${formatBytes(targetSize)}`);
    console.log('Compressing PDF...\n');

    for (let i = 0; i < settings.length; i++) {
      const candidate = path.join(tempDir, `candidate-${i}.pdf`);

      try {
        await runGhostscript(
          ghostscript,
          buildArgs(input, candidate, settings[i])
        );

        if (!fs.existsSync(candidate)) {
          continue;
        }

        const size = fs.statSync(candidate).size;
        if (size === 0) continue;

        const reduction = ((originalSize - size) / originalSize) * 100;

        candidates.push({ path: candidate, size });

        console.log(
          `Pass ${i + 1}: ${formatBytes(size)} ` +
          `(${reduction.toFixed(2)}% reduction; ` +
          `${settings[i].dpi} DPI, JPEG quality ${settings[i].jpegQuality})`
        );

        // A candidate at or below the target is preferable.
        if (size <= targetSize) break;
      } catch (error) {
        console.warn(`Pass ${i + 1} failed: ${error.message}`);
      }
    }

    if (candidates.length === 0) {
      throw new Error('Ghostscript could not produce a compressed PDF.');
    }

    const selected = candidates.find(candidate => candidate.size <= targetSize) ||
      candidates.reduce((smallest, candidate) =>
        candidate.size < smallest.size ? candidate : smallest
      );

    fs.mkdirSync(path.dirname(output), { recursive: true });

    // Copy only after successful compression, preserving the input file.
    fs.copyFileSync(selected.path, output);

    const actualSize = fs.statSync(output).size;
    const actualReduction = ((originalSize - actualSize) / originalSize) * 100;
    const savedBytes = originalSize - actualSize;

    console.log('\n--- Compression result ---');
    console.log(`Output:            ${output}`);
    console.log(`Original size:     ${formatBytes(originalSize)}`);
    console.log(`Compressed size:   ${formatBytes(actualSize)}`);
    console.log(`Space saved:       ${formatBytes(Math.max(0, savedBytes))}`);
    console.log(`Actual reduction:  ${actualReduction.toFixed(2)}%`);

    if (actualReduction < 0) {
      console.log(
        'Note: The output is larger than the original. ' +
        'The original PDF may already be optimized.'
      );
    } else if (actualSize > targetSize) {
      console.log(
        `Note: The requested ${percentage}% reduction could not be reached. ` +
        'The strongest tested settings were used.'
      );
    } else {
      console.log(`Target:            ${percentage}% reduction achieved or exceeded`);
    }

    console.log(
      '\nNote: Aggressive compression can reduce image quality. ' +
      'Review the resulting PDF before using it.'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`PDF compression error: ${error.message}`);
  process.exitCode = 1;
});
