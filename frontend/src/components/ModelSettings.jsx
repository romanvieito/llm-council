import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  DEFAULT_MODEL_CONFIG,
  getOpenRouterKey,
  setOpenRouterKey,
  getModelConfig,
  setModelConfig,
} from '../localStore';
import './ModelSettings.css';

function ModelSettings({ onClose }) {
  const [availableModels, setAvailableModels] = useState([]);
  const [, setCurrentConfig] = useState(null);
  const [systemDefaults, setSystemDefaults] = useState(null);
  const [selectedCouncilModels, setSelectedCouncilModels] = useState([]);
  const [selectedChairmanModel, setSelectedChairmanModel] = useState('');
  const [presets, setPresets] = useState({});
  const [newPresetName, setNewPresetName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('model-config');

  // API Key state (local-only)
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load local config first to show current selection immediately
      const config = getModelConfig();
      setCurrentConfig(config);
      setSystemDefaults(DEFAULT_MODEL_CONFIG);
      setSelectedCouncilModels(config.council_models);
      setSelectedChairmanModel(config.chairman_model);
      setPresets(config.presets || {});

      // Load API key (local)
      const key = getOpenRouterKey();
      if (key) setOpenrouterApiKey(key);

      // Then load available models (requires key). If missing, skip.
      if (key) {
        const models = await api.getAvailableModels();
        setAvailableModels(models);
      } else {
        setAvailableModels([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCouncilModelToggle = (modelId) => {
    setSelectedCouncilModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      } else {
        return [...prev, modelId];
      }
    });
  };

  const handleChairmanModelChange = (modelId) => {
    setSelectedChairmanModel(modelId);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const nextConfig = {
        council_models: selectedCouncilModels,
        chairman_model: selectedChairmanModel,
        presets: presets
      };
      setModelConfig(nextConfig);

      setCurrentConfig(nextConfig);

      // Show success message briefly
      setError('Configuration saved successfully!');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!openrouterApiKey.trim()) {
      setError('API key cannot be empty');
      return;
    }

    try {
      setSavingApiKey(true);
      setError(null);

      const key = openrouterApiKey.trim();
      setOpenRouterKey(key);
      setOpenrouterApiKey(key);

      // Fetch models now that we have a key
      const models = await api.getAvailableModels();
      setAvailableModels(models);

      setError('API key saved successfully!');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    
    const updatedPresets = {
      ...presets,
      [newPresetName.trim()]: {
        council_models: selectedCouncilModels,
        chairman_model: selectedChairmanModel
      }
    };

    try {
      setSaving(true);
      const nextConfig = {
        council_models: selectedCouncilModels,
        chairman_model: selectedChairmanModel,
        presets: updatedPresets
      };
      setModelConfig(nextConfig);
      
      setPresets(updatedPresets);
      setNewPresetName('');
      setError(`Preset "${newPresetName}" saved!`);
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = async (name) => {
    const preset = presets[name];
    if (!preset) return;

    // Update UI immediately
    setSelectedCouncilModels(preset.council_models);
    setSelectedChairmanModel(preset.chairman_model);

    // Persist selection locally so new messages use it
    try {
      setSaving(true);
      setError(null);

      const nextConfig = {
        council_models: preset.council_models,
        chairman_model: preset.chairman_model,
        presets: presets,
      };
      setModelConfig(nextConfig);

      setCurrentConfig(nextConfig);

      setError(`Preset "${name}" applied.`);
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePreset = async (name) => {
    // eslint-disable-next-line no-unused-vars
    const { [name]: deleted, ...remainingPresets } = presets;
    
    try {
      setSaving(true);
      const nextConfig = {
        council_models: selectedCouncilModels,
        chairman_model: selectedChairmanModel,
        presets: remainingPresets
      };
      setModelConfig(nextConfig);
      setPresets(remainingPresets);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (systemDefaults) {
      setSelectedCouncilModels(systemDefaults.council_models);
      setSelectedChairmanModel(systemDefaults.chairman_model);
      setError('Restored system default models.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const filteredModels = availableModels.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.provider.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="model-settings-overlay">
      <div className="model-modal">
        <div className="model-settings-header">
          <h2>Model Settings</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && (
          <div className={`message ${error.includes('successfully') ? 'success' : 'error'}`}>
            {error}
          </div>
        )}

        <div className="model-settings-tabs">
          <button
            className={`tab-button ${activeTab === 'model-config' ? 'active' : ''}`}
            onClick={() => setActiveTab('model-config')}
          >
            Model Configuration
          </button>
          <button
            className={`tab-button ${activeTab === 'api-keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-keys')}
          >
            API Keys
          </button>
        </div>

        <div className="model-settings-content">
          {activeTab === 'api-keys' && (
            <div className="api-keys-section">
            <h3>API Keys</h3>
            <div className="api-key-input-group">
              <label htmlFor="openrouter-api-key">OpenRouter API Key</label>
              <div className="api-key-input-container">
                <input
                  id="openrouter-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={openrouterApiKey}
                  onChange={(e) => setOpenrouterApiKey(e.target.value)}
                  placeholder="Enter your OpenRouter API key"
                  className="api-key-input"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="toggle-visibility-btn"
                  title={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? "🙈" : "👁️"}
                </button>
                <button
                  onClick={handleSaveApiKey}
                  disabled={!openrouterApiKey.trim() || savingApiKey}
                  className="save-api-key-btn"
                >
                  {savingApiKey ? 'Saving...' : 'Save Key'}
                </button>
              </div>
              <small className="api-key-help">
                Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">OpenRouter</a>.
                Your key is stored locally and is sent to this app's backend per request only to proxy calls to OpenRouter (it is not persisted server-side).
              </small>
            </div>
          </div>
          )}

          {activeTab === 'model-config' && (
            <>
              <div className="presets-section">
              <div className="section-header">
                <h3>Configuration Presets</h3>
                <div className="save-preset-input">
                  <input
                    type="text"
                    placeholder="New preset name..."
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                  />
                  <button
                    onClick={handleSavePreset}
                    disabled={!newPresetName.trim() || saving}
                    className="save-preset-btn"
                  >
                    Save Current
                  </button>
                </div>
              </div>
              <div className="presets-list">
                {Object.keys(presets).length > 0 ? (
                  Object.keys(presets).map(name => (
                    <div key={name} className="preset-item">
                      <button
                        className="preset-apply-btn"
                        onClick={() => applyPreset(name)}
                        title={`Apply ${name} preset`}
                      >
                        {name}
                      </button>
                      <button
                        className="preset-delete-btn"
                        onClick={() => deletePreset(name)}
                        title="Delete preset"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-presets">No presets saved yet. Save your current config as "Fast", "Cheap", etc.</div>
                )}
              </div>
            </div>

            <div className="search-section">
              <input
                type="text"
                placeholder="Search models by name, ID, or provider..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="current-config">
              <h3>Current Configuration</h3>
              <div className="config-summary">
                <div className="config-item">
                  <strong>Council Models ({selectedCouncilModels.length})</strong>
                  <div className="model-list">
                    {selectedCouncilModels.length > 0 ? (
                      selectedCouncilModels.map(modelId => {
                        const model = availableModels.find(m => m.id === modelId);
                        return (
                          <span key={modelId} className="model-tag">
                            {model ? model.name : modelId}
                          </span>
                        );
                      })
                    ) : (
                      <span className="no-models-text">No models selected</span>
                    )}
                  </div>
                </div>
                <div className="config-item">
                  <strong>Chairman Model</strong>
                  {selectedChairmanModel ? (
                    <span className="model-tag chairman">
                      {availableModels.find(m => m.id === selectedChairmanModel)?.name || selectedChairmanModel}
                    </span>
                  ) : (
                    <span className="no-models-text">No chairman selected</span>
                  )}
                </div>
              </div>
            </div>

            <div className="models-grid">
              {loading && availableModels.length === 0 ? (
                <div className="loading-models">
                  <div className="loading-spinner"></div>
                  <p>Loading available models...</p>
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="no-models">
                  {searchTerm ? `No models found matching "${searchTerm}"` : 'No models available'}
                </div>
              ) : (
                filteredModels.map(model => {
                  const isSelected = selectedCouncilModels.includes(model.id);
                  const isChairman = selectedChairmanModel === model.id;

                  return (
                    <div
                      key={model.id}
                      className={`model-card ${isSelected ? 'selected' : ''} ${isChairman ? 'is-chairman' : ''}`}
                    >
                      <div className="model-header">
                        <div className="model-info">
                          <div className="model-title-row">
                            <h4>{model.name}</h4>
                            <div className="status-badges">
                              {isSelected && <span className="status-badge council" title="Council Member">👥</span>}
                              {isChairman && <span className="status-badge chairman" title="Council Chairman">👑</span>}
                            </div>
                          </div>
                          <div className="model-meta">
                            <small className="model-id">{model.id}</small>
                            {model.provider && (
                              <>
                                <span className="meta-separator">•</span>
                                <small className="model-provider">{model.provider}</small>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="model-controls">
                          <label className={`control-btn ${isSelected ? 'active' : ''}`} title="Add to Council">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleCouncilModelToggle(model.id)}
                            />
                            Council
                          </label>
                          <label className={`control-btn ${isChairman ? 'active chairman' : ''}`} title="Set as Chairman">
                            <input
                              type="radio"
                              name="chairman"
                              checked={isChairman}
                              onChange={() => handleChairmanModelChange(model.id)}
                            />
                            Chairman
                          </label>
                        </div>
                      </div>

                      {model.description && (
                        <p className="model-description">{model.description}</p>
                      )}

                      <div className="model-details">
                        {model.context_length && (
                          <div className="detail">
                            <span className="detail-label">Context:</span>
                            <span className="detail-value">{model.context_length.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="pricing-details">
                          {model.pricing && model.pricing.prompt && (
                            <div className="detail">
                              <span className="detail-label">In:</span>
                              <span className="detail-value">${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)}/M</span>
                            </div>
                          )}
                          {model.pricing && model.pricing.completion && (
                            <div className="detail">
                              <span className="detail-label">Out:</span>
                              <span className="detail-value">${(parseFloat(model.pricing.completion) * 1000000).toFixed(2)}/M</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            </>
          )}

        </div>

        {activeTab === 'api-keys' && (
          <div className="model-settings-footer">
            <div className="action-buttons">
              <button
                className="cancel-button"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {activeTab === 'model-config' && (
          <div className="model-settings-footer">
            <button
              className="reset-button"
              onClick={handleReset}
              disabled={saving}
              title="Restore hardcoded system default models"
            >
              Restore Defaults
            </button>
            <div className="action-buttons">
              <button
                className="cancel-button"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="save-button"
                onClick={handleSave}
                disabled={saving || selectedCouncilModels.length === 0 || !selectedChairmanModel}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModelSettings;