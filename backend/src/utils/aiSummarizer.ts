/**
 * AI Failure Summarizer
 * Analyzes job error stack traces, error messages, and payload to generate
 * human-readable root-cause explanations & action recommendations.
 */
export function generateAIFailureSummary(jobName: string, payload: string, errorMessage: string, attempts: number): string {
  const errLower = errorMessage.toLowerCase();

  let rootCause = "Execution failure after maximum retries.";
  let recommendation = "Review worker application logs and retry job when service is available.";

  if (errLower.includes('econnrefused') || errLower.includes('timeout') || errLower.includes('fetch failed')) {
    rootCause = "Network connectivity timeout or remote endpoint unreachable.";
    recommendation = "Check target API status, update endpoint URL in payload, or adjust timeout configuration.";
  } else if (errLower.includes('syntaxerror') || errLower.includes('json') || errLower.includes('invalid format')) {
    rootCause = "Malformed payload or payload schema validation failure.";
    recommendation = "Validate job payload against expected JSON schema before resubmitting.";
  } else if (errLower.includes('memory') || errLower.includes('heap out of memory')) {
    rootCause = "Worker memory limit exceeded during payload processing.";
    recommendation = "Increase worker process memory allocation or reduce batch size in job payload.";
  } else if (errLower.includes('permission') || errLower.includes('403') || errLower.includes('unauthorized') || errLower.includes('401')) {
    rootCause = "Authentication token or API key permission failure.";
    recommendation = "Verify credentials in job payload or project environment settings.";
  } else if (errLower.includes('rate limit') || errLower.includes('429')) {
    rootCause = "Upstream API rate limit exceeded.";
    recommendation = "Increase retry delay or lower queue max concurrency setting.";
  }

  return `AI Failure Analysis for "${jobName}" (Failed after ${attempts} attempts):
• Root Cause: ${rootCause}
• Technical Error: "${errorMessage}"
• Recommended Action: ${recommendation}`;
}
