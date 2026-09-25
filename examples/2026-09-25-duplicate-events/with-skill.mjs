export function createInbox(deliver) {
  const attempts = new Map();
  return async function handle(event) {
    const key = JSON.stringify([event.tenantId, event.id]);
    if (attempts.has(key)) {
      await attempts.get(key);
      return { status: 'duplicate' };
    }

    // Publish the shared attempt before deliver can run or reenter handle.
    const attempt = Promise.resolve().then(() => deliver(event)).catch(error => {
      attempts.delete(key);
      throw error;
    });
    attempts.set(key, attempt);
    await attempt;
    return { status: 'delivered' };
  };
}
