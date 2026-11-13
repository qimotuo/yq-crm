import { useState } from 'react'
import { RobotOutlined } from '@ant-design/icons'

export function formatAiReply(text) {
  if (!text) return null
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </span>
  ))
}

function ThinkingBlock({ thinking, streaming, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? streaming)
  if (!thinking) return null
  const isOpen = streaming || open
  return (
    <div className={`ai-thinking${streaming ? ' ai-thinking--live' : ''}`}>
      <button type="button" className="ai-thinking__toggle" onClick={() => setOpen((v) => !v)}>
        <span className="ai-thinking__dot" />
        {streaming ? '深度思考中…' : '思考过程'}
        <span className="ai-thinking__arrow">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="ai-thinking__body">
          {formatAiReply(thinking)}
          {streaming && <span className="ai-stream-cursor" />}
        </div>
      )}
    </div>
  )
}

export default function AiChatPanel({ messages, listRef, className = '' }) {
  return (
    <div className={`ai-chat-panel ${className}`.trim()} ref={listRef}>
      {messages.map((m, idx) => (
        <div key={m.id ?? idx} className={`ai-chat-bubble ai-chat-bubble--${m.role}`}>
          {m.role === 'assistant' && (
            <div className="ai-chat-bubble__avatar"><RobotOutlined /></div>
          )}
          <div className="ai-chat-bubble__body">
            {m.role === 'assistant' && (
              <ThinkingBlock
                thinking={m.thinking}
                streaming={m.thinkingStreaming}
                defaultOpen={m.thinkingStreaming}
              />
            )}
            {m.role === 'assistant' ? (
              <>
                {formatAiReply(m.content)}
                {m.streaming && <span className="ai-stream-cursor" />}
              </>
            ) : m.content}
          </div>
        </div>
      ))}
    </div>
  )
}
