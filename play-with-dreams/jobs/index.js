import { runFill } from './fill.js';
import { runAnalyze } from './analyze.js';
import { runTranslate } from './translate.js';
import { runTranscribe } from './transcribe.js';

let isRunningAnalyze = false;

export const runJobs = async () => {
  await runFill();
  if(isRunningAnalyze) return;
  isRunningAnalyze = true;
  await runTranscribe();
  await runAnalyze();
  isRunningAnalyze = false;
  await runTranslate();
  console.log('All jobs done 🎉');
}