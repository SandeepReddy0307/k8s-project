// Simulates a batch "video transcoding" task. Run as a Kubernetes Job (one-off)
// or CronJob (scheduled). Exits 0 on success so Job reports Completed.
const jobName = process.env.JOB_NAME || 'adhoc-encode';
const titleId = process.env.TITLE_ID || 'unknown';

console.log(`[video-encoder-job:${jobName}] starting transcode for title=${titleId} at ${new Date().toISOString()}`);

const steps = ['probe', 'extract-audio', 'encode-1080p', 'encode-720p', 'encode-480p', 'generate-thumbnails', 'upload'];
let i = 0;
const interval = setInterval(() => {
  if (i >= steps.length) {
    console.log(`[video-encoder-job:${jobName}] completed successfully`);
    clearInterval(interval);
    process.exit(0);
  }
  console.log(`[video-encoder-job:${jobName}] step ${i + 1}/${steps.length}: ${steps[i]}`);
  i += 1;
}, 1000);
