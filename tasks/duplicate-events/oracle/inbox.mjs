export function createInbox(deliver) {
  const completed = new Set();
  const pending = new Map();
  return async function handle(event) {
    const key = JSON.stringify([event.tenantId, event.id]);
    if (completed.has(key)) return {status:'duplicate'};
    if (pending.has(key)) {
      await pending.get(key);
      return {status:'duplicate'};
    }
    const delivery = Promise.resolve().then(() => deliver(event));
    pending.set(key, delivery);
    try {
      await delivery;
      completed.add(key);
      return {status:'delivered'};
    } finally {
      pending.delete(key);
    }
  };
}
