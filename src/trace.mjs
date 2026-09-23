export function parseTrace(text) {
  const result = { completed: false, failed: false, usage: null, commands: 0,
    commandFailures: 0, malformedLines: 0, skillReadObserved: false };
  let usageMissing = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); }
    catch { result.malformedLines++; continue; }
    if (!event || typeof event.type !== 'string') { result.malformedLines++; continue; }
    if (event.type === 'turn.failed' || event.type === 'error') result.failed = true;
    if (event.type === 'turn.completed') {
      result.completed = true;
      const usage = event.usage;
      const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
      if (usage && count(usage.input_tokens) !== null && count(usage.output_tokens) !== null) {
        const next = {inputTokens: usage.input_tokens,
          cachedInputTokens: count(usage.cached_input_tokens), outputTokens: usage.output_tokens};
        if (result.usage) {
          next.inputTokens += result.usage.inputTokens;
          next.outputTokens += result.usage.outputTokens;
          next.cachedInputTokens = next.cachedInputTokens === null || result.usage.cachedInputTokens === null
            ? null : next.cachedInputTokens + result.usage.cachedInputTokens;
        }
        result.usage = next;
      } else usageMissing = true;
    }
    const item = event.item;
    if (event.type === 'item.completed' && item?.type === 'command_execution') {
      result.commands++;
      if (Number.isInteger(item.exit_code) && item.exit_code !== 0) result.commandFailures++;
      if (item.exit_code === 0 && typeof item.command === 'string' &&
          /(?:\/|\\)debugging(?:\/|\\)SKILL\.md\b/.test(item.command)) {
        result.skillReadObserved = true;
      }
    }
  }
  if (usageMissing) result.usage = null;
  return result;
}
