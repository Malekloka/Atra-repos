import { runFill } from './fill.js';
import { runAnalyze } from './analyze.js';
import { runTranslate } from './translate.js';
import { runTranscribe } from './transcribe.js';
import { runSummarize } from './summarize.js';

let isRunningAnalyze = false;

export const runJobs = async (tenantId = 'default') => {
  await runFill(tenantId);
  if(isRunningAnalyze) return;
  isRunningAnalyze = true;
  await runTranscribe(tenantId);
  await runAnalyze(tenantId);
  isRunningAnalyze = false;
  await runTranslate(tenantId);
  await runSummarize(tenantId);
  console.log('All jobs done 🎉');
}