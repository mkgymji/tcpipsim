// Typy uzlů (model.md kap. 2). Koncové uzly mají zásobník protokolů, hub a switch ne.
export const hostTypes = ['pc', 'server'];
export const isHost = (type) => hostTypes.includes(type);
