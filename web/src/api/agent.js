import { BASE_URL, request } from './request'

export function listAgentSessions() {
  return request('/agent/sessions')
}

export function createAgentSession(context) {
  return request('/agent/sessions', {
    method: 'POST',
    body: JSON.stringify({ context: context || null }),
  })
}

export function getAgentSession(sessionId) {
  return request(`/agent/sessions/${sessionId}`)
}

export function deleteAgentSession(sessionId) {
  return request(`/agent/sessions/${sessionId}`, { method: 'DELETE' })
}

export async function agentSessionChatStream(sessionId, message, context, handlers = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/agent/sessions/${sessionId}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, context: context || null }),
  })

  if (res.status === 401) throw new Error('请先登录')
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || '流式请求失败')
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let acc = ''
  let thinkingAcc = ''
  let contentAcc = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    acc += dec.decode(value, { stream: true })
    const blocks = acc.split('\n\n')
    acc = blocks.pop() || ''
    for (const block of blocks) {
      const line = block.trim()
      if (!line.startsWith('data: ')) continue
      const data = JSON.parse(line.slice(6))
      if (data.type === 'thinking') {
        thinkingAcc += data.content || ''
        handlers.onThinking?.(thinkingAcc, contentAcc)
      } else if (data.type === 'content') {
        contentAcc += data.content || ''
        handlers.onContent?.(thinkingAcc, contentAcc)
      } else if (data.type === 'error') {
        handlers.onError?.(data.message || '请求失败')
        throw new Error(data.message || '请求失败')
      } else if (data.type === 'done') {
        handlers.onDone?.(data.session, {
          thinking: data.thinking || thinkingAcc,
          content: data.reply || contentAcc,
          model: data.model,
        })
        return data.session
      }
    }
  }
  return null
}

export function agentSessionChat(sessionId, message, context) {
  return request(`/agent/sessions/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, context: context || null }),
  })
}

export function agentChat(message, context) {
  return request('/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context: context || null }),
  })
}

export function agentCustomerSummary(customerId) {
  return request('/agent/summarize-customer', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  })
}
