// Local-first persistence for the public BYO-key version.
//
// Storage layout:
// - API key: ava.openrouterApiKey.v1
// - Model config: ava.modelConfig.v1
// - Conversation index: ava.conversations.index.v1
// - Conversation blobs: ava.conversation.<id>.v1

const KEY_OPENROUTER = 'ava.openrouterApiKey.v1';
const KEY_MODEL_CONFIG = 'ava.modelConfig.v1';
const KEY_CONV_INDEX = 'ava.conversations.index.v1';

function safeJsonParse(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  // Prefer RFC4122 UUIDs when available.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `conv_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export const DEFAULT_MODEL_CONFIG = {
  // Mirrors current repo defaults for a good OOTB experience.
  council_models: [
    'x-ai/grok-4.1-fast',
    'openai/gpt-5.2-chat',
    'anthropic/claude-haiku-4.5',
    'google/gemini-3-flash'
  ],
  chairman_model: 'openai/gpt-5.2-chat',
  presets: {
    "Fast": {
      council_models: [
        'x-ai/grok-4.1-fast',
        'openai/gpt-5.2-chat',
        'anthropic/claude-haiku-4.5',
        'google/gemini-3-flash'
      ],
      chairman_model: 'openai/gpt-5.2-chat'
    },
    "Heavy": {
      council_models: [
        'x-ai/grok-4',
        'openai/gpt-5.2-pro',
        'anthropic/claude-opus-4.5',
        'google/gemini-3-pro-preview'
      ],
      chairman_model: 'anthropic/claude-opus-4.5'
    }
  },
  defaults: {
    council_models: [
      'x-ai/grok-4.1-fast',
      'openai/gpt-5.2-chat',
      'anthropic/claude-haiku-4.5',
      'google/gemini-3-flash'
    ],
    chairman_model: 'google/gpt-5.2-chat',
  },
};

export const localStore = {
  // ---- API key ----
  getOpenRouterKey() {
    return localStorage.getItem(KEY_OPENROUTER) || '';
  },

  setOpenRouterKey(apiKey) {
    if (!apiKey) {
      localStorage.removeItem(KEY_OPENROUTER);
      return;
    }
    localStorage.setItem(KEY_OPENROUTER, apiKey);
  },

  // ---- Model config ----
  getModelConfig() {
    const raw = localStorage.getItem(KEY_MODEL_CONFIG);
    const parsed = safeJsonParse(raw, null);
    if (!parsed) return null;
    return parsed;
  },

  getModelConfigWithDefaults() {
    const cfg = localStore.getModelConfig();
    if (!cfg) return DEFAULT_MODEL_CONFIG;
    return {
      ...DEFAULT_MODEL_CONFIG,
      ...cfg,
      presets: cfg.presets || DEFAULT_MODEL_CONFIG.presets,
      defaults: DEFAULT_MODEL_CONFIG.defaults,
    };
  },

  setModelConfig(config) {
    // Only persist user-owned fields.
    const toStore = {
      council_models: config.council_models || [],
      chairman_model: config.chairman_model || '',
      presets: config.presets || {},
    };
    localStorage.setItem(KEY_MODEL_CONFIG, JSON.stringify(toStore));
  },

  // ---- Conversations ----
  _conversationKey(id) {
    return `ava.conversation.${id}.v1`;
  },

  listConversations() {
    const raw = localStorage.getItem(KEY_CONV_INDEX);
    const index = safeJsonParse(raw, []);
    if (!Array.isArray(index)) return [];
    return [...index].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  getConversation(id) {
    const raw = localStorage.getItem(localStore._conversationKey(id));
    const conv = safeJsonParse(raw, null);
    return conv;
  },

  createConversation() {
    const id = randomId();
    const conv = {
      id,
      created_at: nowIso(),
      title: 'New Conversation',
      messages: [],
    };
    localStore.saveConversation(conv);
    return conv;
  },

  saveConversation(conversation) {
    if (!conversation?.id) throw new Error('Conversation must have an id');

    localStorage.setItem(
      localStore._conversationKey(conversation.id),
      JSON.stringify(conversation)
    );

    const meta = {
      id: conversation.id,
      created_at: conversation.created_at || nowIso(),
      title: conversation.title || 'New Conversation',
      message_count: Array.isArray(conversation.messages) ? conversation.messages.length : 0,
    };

    const current = localStore.listConversations();
    const next = current.filter((c) => c.id !== meta.id);
    next.unshift(meta);
    localStorage.setItem(KEY_CONV_INDEX, JSON.stringify(next));
  },

  updateConversationTitle(id, title) {
    const conv = localStore.getConversation(id);
    if (!conv) return;
    const updated = { ...conv, title: title || conv.title };
    localStore.saveConversation(updated);
  },
};

// Backwards-compatible named exports (older code imported functions directly).
export function getOpenRouterKey() {
  return localStore.getOpenRouterKey();
}
export function setOpenRouterKey(apiKey) {
  return localStore.setOpenRouterKey(apiKey);
}
export function getModelConfig() {
  return localStore.getModelConfigWithDefaults();
}
export function setModelConfig(config) {
  return localStore.setModelConfig(config);
}
export function listConversations() {
  return localStore.listConversations();
}
export function getConversation(id) {
  return localStore.getConversation(id);
}
export function createConversation() {
  return localStore.createConversation();
}
export function saveConversation(conversation) {
  return localStore.saveConversation(conversation);
}
export function updateConversationTitle(id, title) {
  return localStore.updateConversationTitle(id, title);
}
