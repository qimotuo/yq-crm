import { useCallback, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { PhoneOutlined, PauseOutlined, CloseOutlined } from '@ant-design/icons'
import { endCall, startCall } from '../api/cti'

export default function PhoneBar() {
  const [visible, setVisible] = useState(false)
  const [calling, setCalling] = useState(false)
  const [number, setNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [duration, setDuration] = useState(0)
  const [callId, setCallId] = useState(null)
  const timerRef = useRef(null)
  const durationRef = useRef(0)
  const callIdRef = useRef(null)

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  useEffect(() => {
    callIdRef.current = callId
  }, [callId])

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const hangup = useCallback(async () => {
    clearTimer()
    setCalling(false)
    const id = callIdRef.current
    if (id) {
      try {
        await endCall({ id, duration: durationRef.current, status: 'ended' })
      } catch (e) {
        message.warning(e.message || '通话记录保存失败')
      }
    }
    setTimeout(() => {
      setVisible(false)
      setCallId(null)
    }, 1200)
  }, [])

  const beginCall = useCallback(async (phone, meta = {}) => {
    const digits = String(phone || '').trim()
    if (!digits) {
      message.warning('手机号为空')
      return
    }
    try {
      const res = await startCall({
        phone: digits,
        customerId: meta.customerId || 0,
        customerName: meta.customerName || '',
        remark: meta.remark || '',
      })
      clearTimer()
      setCallId(res.id)
      setNumber(res.phone || digits)
      setCustomerName(res.customerName || meta.customerName || '')
      setVisible(true)
      setCalling(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
      if (res.autoOpenTel) {
        window.open(`tel:${digits}`, '_self')
      }
    } catch (e) {
      message.error(e.message || '外呼失败')
    }
  }, [])

  useEffect(() => {
    window.__crmPhoneCall = beginCall
    return () => {
      clearTimer()
      if (window.__crmPhoneCall === beginCall) delete window.__crmPhoneCall
    }
  }, [beginCall])

  if (!visible) return null

  const mm = String(Math.floor(duration / 60)).padStart(2, '0')
  const ss = String(duration % 60).padStart(2, '0')

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, width: 320, background: '#001529', color: '#fff',
      borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 1000,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>电话条 CTI</span>
        <CloseOutlined style={{ cursor: 'pointer' }} onClick={() => { if (calling) hangup(); else setVisible(false) }} />
      </div>
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <PhoneOutlined style={{ fontSize: 28, color: calling ? '#52c41a' : '#1677ff' }} />
        <div style={{ fontSize: 18, marginTop: 8 }}>{number}</div>
        {customerName ? <div style={{ color: '#bfbfbf', fontSize: 13, marginTop: 4 }}>{customerName}</div> : null}
        <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4 }}>
          {calling ? `通话中 ${mm}:${ss}` : '通话已结束'}
        </div>
      </div>
      {calling && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <button onClick={hangup} style={{ background: '#ff4d4f', border: 'none', color: '#fff', borderRadius: 20, padding: '8px 24px', cursor: 'pointer' }}>
            <PauseOutlined /> 挂断
          </button>
        </div>
      )}
    </div>
  )
}

export function callPhone(phone, meta = {}) {
  if (typeof window !== 'undefined' && window.__crmPhoneCall) {
    window.__crmPhoneCall(phone, meta)
    return
  }
  window.open(`tel:${phone}`)
}
