// No React hooks needed for this component
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onOpenModelSettings,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="header-top">
          <h1>Ava LLM</h1>
          <button className="settings-btn" onClick={onOpenModelSettings} title="Model Settings">
            ⚙️
          </button>
        </div>
        <button className="new-conversation-btn" onClick={onNewConversation}>
          <span>+</span> New Conversation
        </button>
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="no-conversations">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${
                conv.id === currentConversationId ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conversation-title">
                {conv.title || 'New Conversation'}
              </div>
              <div className="conversation-meta">
                {conv.message_count} messages
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
