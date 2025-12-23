import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ModelSettings from './components/ModelSettings';
import { api } from './api';
import {
  listConversations as listLocalConversations,
  getConversation as getLocalConversation,
  createConversation as createLocalConversation,
  saveConversation as saveLocalConversation,
  getOpenRouterKey,
} from './localStore';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [initialSettingsTab, setInitialSettingsTab] = useState('model-config');
  const [hasApiKey, setHasApiKey] = useState(!!getOpenRouterKey());


  // Load conversations on mount
  useEffect(() => {
    try {
      const convs = listLocalConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
    setHasApiKey(!!getOpenRouterKey());
  }, []);

  // Keep api key state in sync if Model Settings changes it.
  // (Also updates when localStorage changes in another tab.)
  useEffect(() => {
    const onStorage = () => setHasApiKey(!!getOpenRouterKey());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId && (!currentConversation || currentConversation.id !== currentConversationId)) {
      try {
        const conv = getLocalConversation(currentConversationId);
        setCurrentConversation(conv);
      } catch (error) {
        console.error('Failed to load conversation:', error);
      }
    }
  }, [currentConversationId, currentConversation]);

  const handleNewConversation = async () => {
    try {
      const newConv = createLocalConversation();
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, message_count: 0 },
        ...conversations,
      ]);
      setCurrentConversationId(newConv.id);
      setCurrentConversation(newConv); // Set the conversation directly to avoid the separate API call
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  const handleOpenModelSettings = (initialTab = 'model-config') => {
    setShowModelSettings(true);
    setInitialSettingsTab(initialTab);
  };

  const handleCloseModelSettings = () => {
    setShowModelSettings(false);
    // Refresh api key state after closing settings (same-tab localStorage write).
    setHasApiKey(!!getOpenRouterKey());
  };

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    setIsLoading(true);
    try {
      const isFirstMessage = (currentConversation?.messages?.length || 0) === 0;

      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message that will be updated progressively
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Send message with streaming
      await api.sendMessageStream(
        currentConversationId,
        content,
        (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage1 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage1 = event.data;
              lastMsg.loading.stage1 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage2 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage2 = event.data;
              lastMsg.metadata = event.metadata;
              lastMsg.loading.stage2 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage3 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage3 = event.data;
              lastMsg.loading.stage3 = false;
              return { ...prev, messages };
            });
            break;

          case 'title_complete':
            setCurrentConversation((prev) => {
              if (!prev) return prev;
              const next = { ...prev, title: event.data?.title || prev.title };
              try {
                saveLocalConversation(next);
              } catch (e) {
                console.error('Failed to persist conversation title:', e);
              }
              return next;
            });
            try {
              const convs = listLocalConversations();
              setConversations(convs);
            } catch (error) {
              console.error('Failed to load conversations:', error);
            }
            break;

          case 'complete':
            // Stream complete, persist conversation locally and refresh sidebar metadata
            setCurrentConversation((prev) => {
              if (!prev) return prev;
              try {
                saveLocalConversation(prev);
              } catch (e) {
                console.error('Failed to persist conversation:', e);
              }
              return prev;
            });
            try {
              const convs = listLocalConversations();
              setConversations(convs);
            } catch (error) {
              console.error('Failed to load conversations:', error);
            }
            setIsLoading(false);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            setIsLoading(false);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      },
      { isFirstMessage }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      if (String(error?.message || error).includes('Missing OpenRouter API key')) {
        setShowModelSettings(true);
      }
      // Remove optimistic messages on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    }
  };

  // Persist local conversation when it changes (best-effort).
  useEffect(() => {
    try {
      if (currentConversation?.id) saveLocalConversation(currentConversation);
    } catch (e) {
      // Avoid throwing in render; just log.
      console.error('Failed to persist conversation:', e);
    }
  }, [currentConversation]);

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onOpenModelSettings={handleOpenModelSettings}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        hasApiKey={hasApiKey}
        onOpenModelSettings={handleOpenModelSettings}
      />
      {showModelSettings && (
        <ModelSettings
          onClose={handleCloseModelSettings}
          initialTab={initialSettingsTab}
        />
      )}
    </div>
  );
}

export default App;
