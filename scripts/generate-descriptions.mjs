/**
 * generate-descriptions.mjs — AI-generated concise exercise descriptions
 *
 * Disposable batch script that uses Claude to rewrite verbose scraped
 * exercise descriptions into concise, mobile-friendly versions.
 *
 * Usage:
 *   node scripts/generate-descriptions.mjs --rename-only
 *   node scripts/generate-descriptions.mjs --sample --format both
 *   node scripts/generate-descriptions.mjs --format html
 *
 * Flags:
 *   --rename-only       Rename description -> descriptionOriginal, skip generation
 *   --sample            Generate 5 exercises from each source for comparison
 *   --sample-count N    Override sample count (default: 5)
 *   --format plain|html|both  Output format (default: both in sample, html otherwise)
 *   --delay N           Delay between batches in ms (default: 1000)
 *   --dry-run           Show what would be generated, don't call API
 *   --compare           Generate both formats, write to _descPlain/_descHtml for UI comparison
 *   --summaries         Regenerate summaries from the current (rewritten) descriptions
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_FILES = [
  resolve(__dirname, '../src/data/learnimprov-exercises.json'),
  resolve(__dirname, '../src/data/improwiki-exercises.json'),
];

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    renameOnly: args.includes('--rename-only'),
    summaries: args.includes('--summaries'),
    sample: args.includes('--sample'),
    sampleCount: 5,
    format: 'html',
    delay: 1000,
    dryRun: args.includes('--dry-run'),
    compare: args.includes('--compare'),
  };

  const scIdx = args.indexOf('--sample-count');
  if (scIdx !== -1 && args[scIdx + 1]) flags.sampleCount = parseInt(args[scIdx + 1], 10);

  const fmtIdx = args.indexOf('--format');
  if (fmtIdx !== -1 && args[fmtIdx + 1]) flags.format = args[fmtIdx + 1];

  // In sample mode, default to both formats for comparison
  if (flags.sample && fmtIdx === -1) flags.format = 'both';

  const delayIdx = args.indexOf('--delay');
  if (delayIdx !== -1 && args[delayIdx + 1]) flags.delay = parseInt(args[delayIdx + 1], 10);

  return flags;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags, decode common entities, collapse whitespace */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove HTML tags not in the allowlist (safety belt for AI output) */
function sanitizeHtml(html) {
  const allowed = ['p', 'ol', 'ul', 'li'];
  // Remove tags not in the allowlist (keep text content)
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    return allowed.includes(tag.toLowerCase()) ? match : '';
  });
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PLAIN = `You are writing concise exercise descriptions for an improv warm-up app used on mobile phones during practice sessions. Write 2-4 sentences (200-400 characters) that tell a session leader what they need to know to run this exercise. Focus on: what players do, the setup (circle, pairs, stage), and the core mechanic. Do not repeat the exercise name. Do not include section headers. Write in present tense, descriptive voice. The app already shows a separate one-line summary, so do not duplicate that. Output plain text only, no HTML tags.`;

const SYSTEM_HTML = `You are writing concise exercise descriptions for an improv warm-up app used on mobile phones during practice sessions. Write a brief intro sentence in a <p> tag, then the key steps as a short <ol> or <ul> (3-5 items max). Total length should be 300-600 characters. Use only <p>, <ol>, <ul>, <li> tags. No attributes, no classes, no <br>, no <h1>-<h6>. Do not repeat the exercise name. The app already shows a separate one-line summary, so do not duplicate that. IMPORTANT: Always preserve player formation and setup details from the original — circle, line, pairs, stage positions, who leaves/enters the room, any special spatial arrangement. These are critical for running the exercise.`;

function buildUserMessage(exercise, plainText) {
  let msg = `Exercise: "${exercise.name}"\n`;
  msg += `Tags: ${exercise.tags.join(', ')}\n`;
  if (exercise.summary) msg += `Summary (already shown separately): ${exercise.summary}\n`;
  msg += `\nOriginal description:\n${plainText}\n`;
  msg += `\nWrite a concise description for this exercise.`;
  return msg;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function generateDescription(client, exercise, format) {
  const originalHtml = exercise.descriptionOriginal || exercise.description;
  const plainText = stripHtml(originalHtml);

  // Skip very short descriptions (already concise enough)
  if (plainText.length < 150) {
    return originalHtml;
  }

  const systemPrompt = format === 'plain' ? SYSTEM_PLAIN : SYSTEM_HTML;
  const userMessage = buildUserMessage(exercise, plainText);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  let output = response.content[0].text.trim();

  if (format === 'html') {
    output = sanitizeHtml(output);
  }

  return output;
}

async function processBatch(client, exercises, format, dryRun) {
  if (dryRun) {
    return exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      result: '[dry run - skipped]',
    }));
  }

  const results = await Promise.all(
    exercises.map(async (ex) => {
      try {
        const result = await generateDescription(client, ex, format);
        return { id: ex.id, name: ex.name, result };
      } catch (err) {
        console.error(`  Error generating for "${ex.name}": ${err.message}`);
        return { id: ex.id, name: ex.name, result: null, error: err.message };
      }
    }),
  );
  return results;
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

const SYSTEM_SUMMARY = `You are writing one-line summaries for improv exercises in a mobile app. Write exactly 1 sentence (80-140 characters) that captures the core mechanic and format of the exercise. Use present tense, active voice. Do not start with "Players" or repeat the exercise name. Focus on what makes this exercise distinct. Output plain text only, no punctuation at the end unless it's a question.`;

async function generateSummary(client, exercise) {
  const descText = stripHtml(exercise.description || exercise.descriptionOriginal || '');
  if (!descText) return exercise.summary;

  const userMsg = `Exercise: "${exercise.name}"\nTags: ${exercise.tags.join(', ')}\nDescription: ${descText}\n\nWrite a one-line summary (80-140 chars).`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    temperature: 0.3,
    system: SYSTEM_SUMMARY,
    messages: [{ role: 'user', content: userMsg }],
  });

  return response.content[0].text.trim();
}

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

function renameDescriptionFields(data) {
  let renamed = 0;
  for (const ex of data.exercises) {
    if (ex.description && !ex.descriptionOriginal) {
      ex.descriptionOriginal = ex.description;
      renamed++;
    }
  }
  return renamed;
}

// ---------------------------------------------------------------------------
// Sample selection — pick exercises with varying description lengths
// ---------------------------------------------------------------------------

function selectSample(exercises, count) {
  const withLength = exercises
    .filter((ex) => ex.descriptionOriginal || ex.description)
    .map((ex) => ({
      ...ex,
      _len: stripHtml(ex.descriptionOriginal || ex.description).length,
    }));

  // Sort by description length, pick evenly spaced samples
  withLength.sort((a, b) => a._len - b._len);
  const step = Math.max(1, Math.floor(withLength.length / count));
  const selected = [];
  for (let i = 0; i < count && i * step < withLength.length; i++) {
    selected.push(withLength[i * step]);
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const flags = parseArgs();

  console.log('generate-descriptions.mjs');
  console.log('========================');
  console.log(`  Mode: ${flags.renameOnly ? 'rename-only' : flags.summaries ? 'summaries' : flags.compare ? 'compare' : flags.sample ? 'sample' : 'full'}`);
  console.log(`  Format: ${flags.format}`);
  if (flags.sample) console.log(`  Sample count: ${flags.sampleCount} per source`);
  if (flags.dryRun) console.log('  DRY RUN - no API calls');
  console.log();

  // Step 1: Rename description -> descriptionOriginal
  for (const filePath of DATA_FILES) {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    const renamed = renameDescriptionFields(data);
    if (renamed > 0) {
      writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      console.log(`  Renamed ${renamed} exercises in ${filePath.split(/[\\/]/).pop()}`);
    } else {
      console.log(`  Already renamed in ${filePath.split(/[\\/]/).pop()}`);
    }
  }

  if (flags.renameOnly) {
    console.log('\nDone (rename only).');
    return;
  }

  // Summaries mode: regenerate summaries from current descriptions
  if (flags.summaries) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('\nError: ANTHROPIC_API_KEY environment variable is required.');
      process.exit(1);
    }

    const client = new Anthropic();

    for (const filePath of DATA_FILES) {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const fileName = filePath.split(/[\\/]/).pop();
      const exercises = flags.sample
        ? selectSample(data.exercises, flags.sampleCount)
        : data.exercises;

      console.log(`\nGenerating summaries for ${fileName} (${exercises.length} exercises)...`);

      for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
        const batch = exercises.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(
          batch.map(async (ex) => {
            try {
              const summary = await generateSummary(client, ex);
              return { id: ex.id, name: ex.name, summary };
            } catch (err) {
              console.error(`  Error for "${ex.name}": ${err.message}`);
              return { id: ex.id, name: ex.name, summary: null };
            }
          }),
        );

        for (const r of results) {
          if (flags.sample) {
            const ex = data.exercises.find((e) => e.id === r.id);
            console.log(`\n  ${r.name}:`);
            console.log(`    OLD: ${ex.summary}`);
            console.log(`    NEW: ${r.summary}`);
          } else if (r.summary) {
            const ex = data.exercises.find((e) => e.id === r.id);
            if (ex) ex.summary = r.summary;
            process.stdout.write('.');
          } else {
            process.stdout.write('X');
          }
        }

        if (i + BATCH_SIZE < exercises.length) {
          await new Promise((r) => setTimeout(r, flags.delay));
        }
      }

      if (!flags.sample) {
        writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        console.log(`\n  Saved ${fileName}`);
      }
    }

    console.log('\nDone (summaries).');
    return;
  }

  // Step 2a: Compare mode — generate both formats, write to _descPlain/_descHtml
  if (flags.compare) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('\nError: ANTHROPIC_API_KEY environment variable is required.');
      process.exit(1);
    }

    const client = new Anthropic();

    for (const filePath of DATA_FILES) {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const fileName = filePath.split(/[\\/]/).pop();
      const exercises = flags.sample
        ? selectSample(data.exercises, flags.sampleCount)
        : data.exercises;

      console.log(`\nCompare mode: ${fileName} (${exercises.length} exercises)...`);

      for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
        const batch = exercises.slice(i, i + BATCH_SIZE);

        // Generate both formats in parallel for each exercise
        const results = await Promise.all(
          batch.map(async (ex) => {
            try {
              const [plain, html] = await Promise.all([
                generateDescription(client, ex, 'plain'),
                generateDescription(client, ex, 'html'),
              ]);
              return { id: ex.id, name: ex.name, plain, html };
            } catch (err) {
              console.error(`  Error for "${ex.name}": ${err.message}`);
              return { id: ex.id, name: ex.name, plain: null, html: null };
            }
          }),
        );

        for (const r of results) {
          const ex = data.exercises.find((e) => e.id === r.id);
          if (ex) {
            if (r.plain) ex._descPlain = r.plain;
            if (r.html) ex._descHtml = r.html;
            process.stdout.write('.');
          } else {
            process.stdout.write('X');
          }
        }

        if (i + BATCH_SIZE < exercises.length) {
          await new Promise((r) => setTimeout(r, flags.delay));
        }
      }

      writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      console.log(`\n  Saved ${fileName}`);
    }

    console.log('\nDone (compare). Open the app and use the format toggle in the detail modal.');
    return;
  }

  // Step 2: Generate descriptions
  if (!flags.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error('\nError: ANTHROPIC_API_KEY environment variable is required.');
    process.exit(1);
  }

  const client = flags.dryRun ? null : new Anthropic();
  const formats = flags.format === 'both' ? ['plain', 'html'] : [flags.format];

  for (const filePath of DATA_FILES) {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    const fileName = filePath.split(/[\\/]/).pop();
    console.log(`\nProcessing ${fileName} (${data.exercises.length} exercises)...`);

    const exercises = flags.sample
      ? selectSample(data.exercises, flags.sampleCount)
      : data.exercises;

    console.log(`  Selected ${exercises.length} exercises`);

    for (const format of formats) {
      console.log(`\n  Format: ${format}`);
      console.log('  ' + '-'.repeat(60));

      // Process in batches
      for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
        const batch = exercises.slice(i, i + BATCH_SIZE);
        const results = await processBatch(client, batch, format, flags.dryRun);

        for (const r of results) {
          if (flags.sample) {
            // Print comparison output for sample mode
            const ex = data.exercises.find((e) => e.id === r.id);
            const origText = stripHtml(ex.descriptionOriginal || ex.description);
            console.log(`\n  === ${r.name} (${origText.length} chars original) ===`);
            if (ex.summary) console.log(`  Summary: ${ex.summary}`);
            console.log(`\n  ${format.toUpperCase()} (${(r.result || '').length} chars):`);
            console.log(`  ${r.result || '[error]'}`);
            console.log(`\n  ORIGINAL (first 300 chars):`);
            console.log(`  ${origText.slice(0, 300)}...`);
          } else {
            // Full mode: write back to data
            if (r.result) {
              const ex = data.exercises.find((e) => e.id === r.id);
              if (ex) ex.description = r.result;
              process.stdout.write('.');
            } else {
              process.stdout.write('X');
            }
          }
        }

        // Delay between batches (not after the last one)
        if (i + BATCH_SIZE < exercises.length) {
          await new Promise((r) => setTimeout(r, flags.delay));
        }
      }

      // In full mode, save after each format (only the last format matters)
      if (!flags.sample && !flags.dryRun) {
        writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        console.log(`\n  Saved ${fileName}`);
      }
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
