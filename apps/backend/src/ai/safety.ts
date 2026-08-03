export interface SafetyResult {
  urgent: boolean;
  response?: string;
}

const urgentPatterns = [
  /not\s+breathing/i,
  /blue\s+(lips|face|skin)/i,
  /seizure/i,
  /won'?t\s+wake\s+up/i,
  /unconscious/i,
  /choking/i
];

const emergencyResponse =
  'This may be an emergency. Please contact your local emergency services or seek urgent medical care right away. If you can do so safely, stay with your baby and follow local emergency guidance.';

export function checkUrgentRedFlags(message: string): SafetyResult {
  return urgentPatterns.some((pattern) => pattern.test(message))
    ? { urgent: true, response: emergencyResponse }
    : { urgent: false };
}
