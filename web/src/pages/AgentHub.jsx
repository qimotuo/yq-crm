import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Space, Spin, Tag, Typography, message } from 'antd'
import {
  BulbOutlined, DeleteOutlined, PlusOutlined, RobotOutlined,
  SendOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import AiChatPanel from '../components/AiChatPanel'
import {
  agentSessionChatStream,
  createAgentSession,
  deleteAgentSession,
  getAgentSession,
  listAgentSessions,
} from '../api/agent'
import { useAgentContext } from '../context/AgentContext'
import '../styles/agent-hub.css'

const { Text, Title, Paragraph } = Typography

const CAPABILITIES = [
  { icon: <BulbOutlined />, title: '客户洞察', desc: '回款、跟进、安装状态一屏解读' },
  { icon: <ThunderboltOutlined />, title: '流程指引', desc: '派工、登记、财务录入步骤答疑' },
  { icon: <RobotOutlined />, title: '上下文感知', desc: '自动结合当前页面与客户信息' },
]

const SCENE_PROMPTS = [
  { label: '销售场景', prompts: ['这个客户回款情况怎么样？', '有什么跟进建议？', '如何快速建工单？'] },
  { label: '运维场景', prompts: ['安装登记需要填哪些信息？', 'MAC 重复了怎么办？', '怎么查设备全链路？'] },
  { label: '财务场景', prompts: ['如何录入回款？', '逾期账单怎么处理？', '合同和账单怎么关联？'] },
]

function getQuickPrompts(context) {
  if (context.customerName) {
    return ['这个客户回款情况怎么样？', '有什么跟进建议？', '安装进度如何？']
  }
  return ['如何录入回款？', '安装登记流程是什么？', '怎么查全链路追溯？']
}

function toPanelMessages(messages = []) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    thinking: m.thinking || '',
  }))
}

export default function AgentHub() {
  const { context, mergeAgentContext } = useAgentContext()
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const listRef = useRef(null)

  const chatContext = useMemo(() => ({
    ...context,
    page: '智脑中枢',
    path: '/ai-agent',
  }), [context])

  const loadSessionMessages = useCallback(async (sessionId) => {
    const detail = await getAgentSession(sessionId)
    setMessages(toPanelMessages(detail.messages))
    setSessions((prev) => prev.map((s) => (
      s.id === sessionId ? { ...s, title: detail.title, updatedAt: detail.updatedAt } : s
    )))
  }, [])

  const bootstrap = useCallback(async () => {
    setPageLoading(true)
    try {
      const res = await listAgentSessions()
      let list = res.list || []
      if (!list.length) {
        const created = await createAgentSession(chatContext)
        list = [{ id: created.id, title: created.title, updatedAt: created.updatedAt }]
        setMessages(toPanelMessages(created.messages))
        setActiveId(created.id)
      } else {
        setActiveId(list[0].id)
        await loadSessionMessages(list[0].id)
      }
      setSessions(list)
    } catch (e) {
      message.error(e.message || '加载会话失败')
    } finally {
      setPageLoading(false)
    }
  }, [chatContext, loadSessionMessages])

  useEffect(() => {
    mergeAgentContext({ page: '智脑中枢', path: '/ai-agent' })
  }, [mergeAgentContext])

  useEffect(() => {
    bootstrap()
  }, [])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const syncSessionList = (session) => {
    setSessions((prev) => {
      const next = prev.map((s) => (
        s.id === session.id ? { id: session.id, title: session.title, updatedAt: session.updatedAt } : s
      ))
      if (!next.some((s) => s.id === session.id)) {
        next.unshift({ id: session.id, title: session.title, updatedAt: session.updatedAt })
      }
      return [...next].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    })
  }

  const handleSend = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading || !activeId) return
    setInput('')
    setLoading(true)
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: msg },
      {
        role: 'assistant',
        content: '',
        thinking: '',
        streaming: false,
        thinkingStreaming: true,
      },
    ])
    try {
      await agentSessionChatStream(activeId, msg, chatContext, {
        onThinking: (thinking, content) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last?.role !== 'assistant') return prev
            next[next.length - 1] = {
              ...last,
              thinking,
              content,
              thinkingStreaming: true,
              streaming: false,
            }
            return next
          })
        },
        onContent: (thinking, content) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last?.role !== 'assistant') return prev
            next[next.length - 1] = {
              ...last,
              thinking,
              content,
              thinkingStreaming: false,
              streaming: true,
            }
            return next
          })
        },
        onDone: (session) => {
          setMessages(toPanelMessages(session.messages))
          syncSessionList(session)
        },
        onError: (errMsg) => {
          message.error(errMsg)
        },
      })
    } catch (e) {
      message.error(e.message || '发送失败')
      setMessages((prev) => [
        ...prev.filter((m) => !m.thinkingStreaming && !m.streaming),
        { role: 'assistant', content: `请求失败：${e.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const newSession = async () => {
    try {
      const created = await createAgentSession(chatContext)
      setSessions((prev) => [
        { id: created.id, title: created.title, updatedAt: created.updatedAt },
        ...prev,
      ])
      setActiveId(created.id)
      setMessages(toPanelMessages(created.messages))
    } catch (e) {
      message.error(e.message || '创建会话失败')
    }
  }

  const switchSession = async (id) => {
    if (id === activeId) return
    setActiveId(id)
    setPageLoading(true)
    try {
      await loadSessionMessages(id)
    } catch (e) {
      message.error(e.message || '加载消息失败')
    } finally {
      setPageLoading(false)
    }
  }

  const removeSession = async (id, e) => {
    e.stopPropagation()
    try {
      await deleteAgentSession(id)
      const res = await listAgentSessions()
      let list = res.list || []
      if (!list.length) {
        const created = await createAgentSession(chatContext)
        list = [{ id: created.id, title: created.title, updatedAt: created.updatedAt }]
        setActiveId(created.id)
        setMessages(toPanelMessages(created.messages))
      } else if (activeId === id) {
        setActiveId(list[0].id)
        await loadSessionMessages(list[0].id)
      }
      setSessions(list)
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const contextHint = [context.page !== '智脑中枢' ? context.page : null, context.customerName, context.orderNo]
    .filter(Boolean).join(' · ')
  const quickPrompts = getQuickPrompts(context)

  if (pageLoading && !sessions.length) {
    return (
      <div className="agent-hub agent-hub--loading">
        <Spin size="large" tip="加载会话…" />
      </div>
    )
  }

  return (
    <div className="agent-hub">
      <div className="agent-hub__hero">
        <div className="agent-hub__hero-glow" />
        <Space align="start" size={16}>
          <div className="agent-hub__hero-icon"><RobotOutlined /></div>
          <div>
            <Title level={3} className="agent-hub__title">智脑中枢</Title>
            <Paragraph className="agent-hub__subtitle">
              企业级 CRM 认知助手 · 会话已云端保存
            </Paragraph>
            <Space wrap size={[8, 8]}>
              {CAPABILITIES.map((c) => (
                <Tag key={c.title} icon={c.icon} className="agent-hub__cap-tag">{c.title}</Tag>
              ))}
            </Space>
          </div>
        </Space>
      </div>

      <div className="agent-hub__body">
        <aside className="agent-hub__sidebar">
          <Button type="primary" block icon={<PlusOutlined />} onClick={newSession} className="agent-hub__new-btn">
            新建会话
          </Button>
          <div className="agent-hub__session-list">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`agent-hub__session${s.id === activeId ? ' agent-hub__session--active' : ''}`}
                onClick={() => switchSession(s.id)}
              >
                <Text ellipsis className="agent-hub__session-title">{s.title}</Text>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  className="agent-hub__session-del"
                  onClick={(e) => removeSession(s.id, e)}
                />
              </div>
            ))}
          </div>
        </aside>

        <main className="agent-hub__main">
          {contextHint && (
            <div className="agent-hub__context">
              <Text type="secondary" style={{ fontSize: 12 }}>业务上下文：{contextHint}</Text>
            </div>
          )}

          {pageLoading ? (
            <div className="agent-hub__chat-loading"><Spin tip="加载中…" /></div>
          ) : (
            <AiChatPanel messages={messages} listRef={listRef} className="agent-hub__chat" />
          )}

          <div className="agent-hub__scenes">
            {SCENE_PROMPTS.map((scene) => (
              <div key={scene.label} className="agent-hub__scene-group">
                <Text type="secondary" className="agent-hub__scene-label">{scene.label}</Text>
                <Space wrap size={[6, 6]}>
                  {scene.prompts.map((q) => (
                    <Button key={q} size="small" type="dashed" disabled={loading || pageLoading} onClick={() => handleSend(q)}>
                      {q}
                    </Button>
                  ))}
                </Space>
              </div>
            ))}
          </div>

          <div className="agent-hub__quick">
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>快捷提问</Text>
            {quickPrompts.map((q) => (
              <Button key={q} size="small" type="link" disabled={loading || pageLoading} onClick={() => handleSend(q)}>
                {q}
              </Button>
            ))}
          </div>

          <div className="agent-hub__input">
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入业务问题，Enter 发送，Shift+Enter 换行"
              autoSize={{ minRows: 2, maxRows: 5 }}
              disabled={!activeId || pageLoading}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              loading={loading}
              disabled={!activeId || pageLoading}
              className="agent-hub__send"
              onClick={() => handleSend()}
            >
              发送
            </Button>
          </div>
        </main>
      </div>
    </div>
  )
}
