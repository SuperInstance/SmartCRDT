#!/usr/bin/env node
/**
 * VL-JEPA Training Script Wrapper
 *
 * This wrapper script runs the VL-JEPA training from the demo directory
 * to ensure proper workspace package resolution.
 *
 * Usage:
 *   node scripts/vljepa-train.mjs [options]
 *
 * @packageDocumentation
 */

import { IntentPredictor, TrainingPipeline, DataExporter } from '@lsi/cascade/vljepa';
import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const flags = {
    data: './data/vljepa',
    checkpoint: './checkpoints/vljepa',
    epochs: 50,
    lr: '0.01',
    batch: 32,
    patience: 10,
    generate: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--generate') {
      flags.generate = true;
    } else if (arg.startsWith('--data=')) {
      flags.data = arg.split('=')[1];
    } else if (arg.startsWith('--checkpoint=')) {
      flags.checkpoint = arg.split('=')[1];
    } else if (arg.startsWith('--lr=')) {
      flags.lr = arg.split('=')[1];
    } else if (arg.startsWith('--epochs=')) {
      flags.epochs = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--batch=')) {
      flags.batch = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--patience=')) {
      flags.patience = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--')) {
      // Handle space-separated arguments
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        switch (arg) {
          case '--data':
            flags.data = nextArg;
            i++;
            break;
          case '--checkpoint':
            flags.checkpoint = nextArg;
            i++;
            break;
          case '--lr':
            flags.lr = nextArg;
            i++;
            break;
          case '--epochs':
            flags.epochs = parseInt(nextArg);
            i++;
            break;
          case '--batch':
            flags.batch = parseInt(nextArg);
            i++;
            break;
          case '--patience':
            flags.patience = parseInt(nextArg);
            i++;
            break;
        }
      }
    }
  }

  return flags;
}

/**
 * Main training function.
 */
async function main() {
  // Parse command line arguments
  const flags = parseArgs(process.argv.slice(2));

  // Show help
  if (flags.help) {
    console.log(`
VL-JEPA Intent Prediction Model Training

Usage:
  node scripts/vljepa-train.mjs [options]

Options:
  --help              Show this help message
  --generate          Generate synthetic training data
  --data PATH         Data directory (default: ./data/vljepa)
  --checkpoint PATH   Checkpoint directory (default: ./checkpoints/vljepa)
  --epochs N          Number of epochs (default: 50)
  --lr RATE           Learning rate (default: 0.01)
  --batch N           Batch size (default: 32)
  --patience N        Early stopping patience (default: 10)

Examples:
  node scripts/vljepa-train.mjs --generate
  node scripts/vljepa-train.mjs --epochs 100 --lr 0.001
  node scripts/vljepa-train.mjs --data ./mydata --checkpoint ./mycheckpoints
    `);
    process.exit(0);
  }

  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'VL-JEPA Intent Prediction Training' + ' '.repeat(10) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log();

  // Generate data if requested
  if (flags.generate) {
    console.log('Generating synthetic training data...');
    await DataExporter.generateDataset(flags.data, {
      examplesPerIntent: 100,
      includeVariations: true,
      seed: 42
    });
    console.log();
  }

  // Check if data exists
  try {
    await access(`${flags.data}/train.jsonl`, constants.R_OK);
    await access(`${flags.data}/val.jsonl`, constants.R_OK);
  } catch {
    console.error('Error: Training data not found!');
    console.error('Run with --generate to create synthetic data, or provide --data path to existing data.');
    process.exit(1);
  }

  // Initialize predictor
  console.log('Initializing VL-JEPA Intent Predictor...');
  const predictor = new IntentPredictor({
    jepaConfig: {
      xEncoder: {
        embeddingModel: 'openai',
        cacheEnabled: true
      },
      predictor: {
        inputDim: 768,
        outputDim: 256,
        hiddenDim: 512,
        learningRate: parseFloat(flags.lr)
      },
      yEncoder: {
        dimension: 256,
        numIntents: 12,
        randomInit: false
      }
    },
    threshold: 0.3,
    onlineLearning: true
  });
  console.log('✓ Predictor initialized');
  console.log();

  // Initialize pipeline
  const pipeline = new TrainingPipeline(predictor, {
    epochs: flags.epochs,
    learningRate: parseFloat(flags.lr),
    batchSize: flags.batch,
    validationInterval: 1,
    earlyStoppingPatience: flags.patience,
    checkpointDir: flags.checkpoint,
    lrDecay: true,
    lrDecayFactor: 0.95
  });
  console.log('✓ Training pipeline initialized');
  console.log();

  // Start training
  console.log('Starting training...');
  console.log('Configuration:');
  console.log(`  Epochs: ${flags.epochs}`);
  console.log(`  Learning Rate: ${flags.lr}`);
  console.log(`  Batch Size: ${flags.batch}`);
  console.log(`  Early Stopping Patience: ${flags.patience}`);
  console.log(`  Data: ${flags.data}`);
  console.log(`  Checkpoints: ${flags.checkpoint}`);
  console.log();
  console.log('─'.repeat(60));
  console.log();

  const startTime = Date.now();
  const metrics = await pipeline.train(flags.data);
  const totalDuration = (Date.now() - startTime) / 1000;

  console.log();
  console.log('─'.repeat(60));
  console.log();
  console.log(`Training completed in ${totalDuration.toFixed(1)}s`);

  // Save final model
  const finalPath = `${flags.checkpoint}/final.json`;
  await predictor.save(finalPath);
  console.log(`✓ Model saved to ${finalPath}`);

  // Generate and save report
  const report = pipeline.generateReport(metrics);
  const reportPath = `${flags.checkpoint}/report.md`;
  await writeFile(reportPath, report);
  console.log(`✓ Report saved to ${reportPath}`);

  // Print report
  console.log();
  console.log(report);
}

// Run main function
main().catch(error => {
  console.error('Training failed:', error);
  process.exit(1);
});
