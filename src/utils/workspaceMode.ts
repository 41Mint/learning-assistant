export const TEST_WORKSPACE_HREF = '?workspace=knowledge-demo#today';
export const IS_TEST_WORKSPACE = new URLSearchParams(globalThis.location?.search).get('workspace') === 'knowledge-demo';

export const STORAGE_PREFIX = IS_TEST_WORKSPACE ? 'learning-assistant-demo:' : 'learning-assistant:';
export const ASSET_DATABASE_NAME = IS_TEST_WORKSPACE ? 'learning-assistant-demo-assets' : 'learning-assistant-assets';
