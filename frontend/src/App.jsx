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
  const [modelSettingsTab, setModelSettingsTab] = useState('model-config');
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
    setModelSettingsTab(initialTab);
    setShowModelSettings(true);
  };

  const handleCloseModelSettings = () => {
    setShowModelSettings(false);
    // Refresh api key state after closing settings (same-tab localStorage write).
    setHasApiKey(!!getOpenRouterKey());
  };

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    setIsLoading(true);
    let streamFinished = false;
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

      // Build conversation context from prior messages (Stage 3-only history)
      // Include user messages + assistant stage3.response only, apply rolling window + size cap
      const buildConversationContext = (messages) => {
        const context = [];
        const maxTurns = 8; // Keep last 8 user+assistant pairs
        const maxTotalChars = 20000; // 20k char budget as token proxy
        let totalChars = 0;

        // Process messages in reverse order to get the most recent ones first
        const priorMessages = messages.filter(msg =>
          msg.role === 'user' || (msg.role === 'assistant' && msg.stage3?.response)
        );

        for (let i = priorMessages.length - 1; i >= 0 && context.length < maxTurns * 2; i--) {
          const msg = priorMessages[i];
          const content = msg.role === 'user' ? msg.content : msg.stage3.response;
          const contextMsg = { role: msg.role, content };

          // Check if adding this message would exceed the character limit
          const msgChars = JSON.stringify(contextMsg).length;
          if (totalChars + msgChars > maxTotalChars) {
            break;
          }

          context.unshift(contextMsg); // Add to front to maintain chronological order
          totalChars += msgChars;
        }

        return context;
      };

      const conversationContext = buildConversationContext(currentConversation.messages);

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
              // Defensive: if earlier stage completion was missed, don't leave spinners running.
              lastMsg.loading.stage1 = false;
              lastMsg.loading.stage2 = false;
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
              // Ensure no stage spinners remain stuck.
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              if (lastMsg?.loading) {
                lastMsg.loading.stage1 = false;
                lastMsg.loading.stage2 = false;
                lastMsg.loading.stage3 = false;
              }
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
            // Ensure we clear any stage spinners on error.
            setCurrentConversation((prev) => {
              if (!prev) return prev;
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              if (lastMsg?.loading) {
                lastMsg.loading.stage1 = false;
                lastMsg.loading.stage2 = false;
                lastMsg.loading.stage3 = false;
              }
              return { ...prev, messages };
            });
            setIsLoading(false);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      },
      { isFirstMessage, conversationContext }
      );
      streamFinished = true;
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
    } finally {
      // Guaranteed finalization in case the `complete` SSE event was dropped.
      if (streamFinished) {
        setCurrentConversation((prev) => {
          if (!prev) return prev;
          const messages = [...prev.messages];
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.loading) {
            lastMsg.loading.stage1 = false;
            lastMsg.loading.stage2 = false;
            lastMsg.loading.stage3 = false;
          }
          try {
            saveLocalConversation(prev);
          } catch (e) {
            console.error('Failed to persist conversation:', e);
          }
          return { ...prev, messages };
        });
        try {
          const convs = listLocalConversations();
          setConversations(convs);
        } catch (error) {
          console.error('Failed to load conversations:', error);
        }
      }
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
        <ModelSettings onClose={handleCloseModelSettings} initialTab={modelSettingsTab} />
      )}
    </div>
  );
}

export default App;
