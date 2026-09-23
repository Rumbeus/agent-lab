export function createInbox(deliver) {
  const seen = new Set();
  return async function handle(event) {
    if (seen.has(event.id)) return { status: 'duplicate' };
    seen.add(event.id);
    await deliver(event);
    return { status: 'delivered' };
  };
}
