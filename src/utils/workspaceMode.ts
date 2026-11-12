export const KNOWLEDGE_DEMO_HREF = '?workspace=knowledge-demo#network';
export const IS_KNOWLEDGE_DEMO = new URLSearchParams(globalThis.location?.search).get('workspace') === 'knowledge-demo';

export const STORAGE_PREFIX = IS_KNOWLEDGE_DEMO ? 'learning-assistant-demo:' : 'learning-assistant:';
export const ASSET_DATABASE_NAME = IS_KNOWLEDGE_DEMO ? 'learning-assistant-demo-assets' : 'learning-assistant-assets';
