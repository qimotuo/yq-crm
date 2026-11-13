import { useCallback, useEffect, useRef, useState } from 'react'
import { agentChat } from '../api/agent'

const WELCOME = '你好，我是智脑中枢 · CRM 认知助手。可解读客户、工单、财务与安装全流程，并结合当前业务上下文给出建议。'

export function useAiChat(context = {}, initialMessages) {
  const [messages, setMessages] = useState(
    initialMessages?.length ? initialMessages : [{ role: 'assistant', content: WELCOME }],
  )
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, loading])

  const send = useCallback(async (text, inputRef) => {
    const msg = (text || inputRef?.current?.value || '').trim()
    if (!msg || loading) return false
    if (inputRef?.current) inputRef.current.value = ''
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await agentChat(msg, context)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }])
      return true
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `请求失败：${e.message}` }])
      return false
    } finally {
      setLoading(false)
    }
  }, [context, loading])

  const reset = useCallback(() => {
    setMessages([{ role: 'assistant', content: WELCOME }])
  }, [])

  return { messages, setMessages, loading, listRef, send, reset, welcome: WELCOME }
}
