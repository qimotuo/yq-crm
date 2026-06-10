import { useState } from 'react'
import { PhoneOutlined, PauseOutlined, CloseOutlined } from '@ant-design/icons'

export default function PhoneBar() {
  const [visible, setVisible] = useState(false)
  const [calling, setCalling] = useState(false)
  const [number, setNumber] = useState('')
  const [duration, setDuration] = useState(0)

  const startCall = (phone) => {
    setNumber(phone)
    setVisible(true)
    setCalling(true)
    setDuration(0)
    const timer = setInterval(() => setDuration((d) => d + 1), 1000)
    window._phoneTimer = timer
  }

  const endCall = () => {
    setCalling(false)
    clearInterval(window._phoneTimer)
    setTimeout(() => setVisible(false), 1500)
  }

  // 全局暴露供外呼按钮调用
  if (typeof window !== 'undefined') {
    window.demoPhoneCall = startCall
  }

  if (!visible) return null

  const mm = String(Math.floor(duration / 60)).padStart(2, '0')
  const ss = String(duration % 60).padStart(2, '0')

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, width: 320, background: '#001529', color: '#fff',
      borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 1000,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>电话条</span>
        <CloseOutlined style={{ cursor: 'pointer' }} onClick={() => setVisible(false)} />
      </div>
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <PhoneOutlined style={{ fontSize: 28, color: calling ? '#52c41a' : '#1677ff' }} />
        <div style={{ fontSize: 18, marginTop: 8 }}>{number}</div>
        <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4 }}>
          {calling ? `通话中 ${mm}:${ss}` : '通话已结束'}
        </div>
      </div>
      {calling && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <button onClick={endCall} style={{ background: '#ff4d4f', border: 'none', color: '#fff', borderRadius: 20, padding: '8px 24px', cursor: 'pointer' }}>
            <PauseOutlined /> 挂断
          </button>
        </div>
      )}
    </div>
  )
}

export function callPhone(phone) {
  if (window.demoPhoneCall) window.demoPhoneCall(phone)
  else window.open(`tel:${phone}`)
}
