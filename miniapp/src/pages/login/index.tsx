import { useState } from 'react'
import { View, Input, Button, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { login, wechatLogin } from '@/api/auth'
import { saveAuth, getHomeTab } from '@/utils/auth'
import './index.scss'

type LoginMode = 'wx' | 'account'

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('wx')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [wxLoading, setWxLoading] = useState(false)

  const ensureAgreed = () => {
    if (!agreed) {
      Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' })
      return false
    }
    return true
  }

  const afterLogin = (res: Awaited<ReturnType<typeof login>>) => {
    saveAuth(res.token, res.user, res.permissions)
    Taro.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      Taro.switchTab({ url: getHomeTab() })
    }, 500)
  }

  const handleLogin = async () => {
    if (!ensureAgreed()) return
    if (!username || !password) {
      Taro.showToast({ title: '请输入账号和密码', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      afterLogin(await login(username, password))
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleWxLogin = async () => {
    if (!ensureAgreed()) return
    setWxLoading(true)
    try {
      const { code } = await Taro.login()
      if (!code) {
        Taro.showToast({ title: '获取微信授权失败', icon: 'none' })
        return
      }
      afterLogin(await wechatLogin(code))
    } catch (e) {
      const msg = (e as Error).message
      Taro.showModal({
        title: '微信登录',
        content: msg.includes('未绑定')
          ? `${msg}\n\n请切换账号登录后，在「我的」中绑定微信。`
          : msg,
        showCancel: false,
        success: () => { if (msg.includes('未绑定')) setMode('account') },
      })
    } finally {
      setWxLoading(false)
    }
  }

  const openProtocol = (type: 'user' | 'privacy') => {
    Taro.navigateTo({ url: `/pages/login/protocol?type=${type}` })
  }

  return (
    <View className='login-page'>
      <View className='brand'>
        <View className='brand-mark'>基</View>
        <Text className='brand-name'>基米网</Text>
        <Text className='brand-desc'>宽带业务移动工作台</Text>
      </View>

      <View className='login-panel'>
        <View className='mode-switch'>
          <View
            className={`mode-item ${mode === 'wx' ? 'active' : ''}`}
            onClick={() => setMode('wx')}
          >
            <Text>微信登录</Text>
          </View>
          <View
            className={`mode-item ${mode === 'account' ? 'active' : ''}`}
            onClick={() => setMode('account')}
          >
            <Text>账号登录</Text>
          </View>
        </View>

        {mode === 'wx' ? (
          <View className='mode-content'>
            <Text className='mode-hint'>授权微信快速登录，安全便捷</Text>
            <Button className='btn-wx' loading={wxLoading} disabled={!agreed} onClick={handleWxLogin}>
              微信一键登录
            </Button>
          </View>
        ) : (
          <View className='mode-content'>
            <View className='field'>
              <Input
                className='field-input'
                value={username}
                placeholder='账号'
                placeholderClass='field-placeholder'
                onInput={(e) => setUsername(e.detail.value)}
              />
            </View>
            <View className='field'>
              <Input
                className='field-input'
                password
                value={password}
                placeholder='密码'
                placeholderClass='field-placeholder'
                onInput={(e) => setPassword(e.detail.value)}
              />
            </View>
            <Button className='btn-login' loading={loading} disabled={!agreed} onClick={handleLogin}>
              登录
            </Button>
          </View>
        )}
      </View>

      <View className='agreement' onClick={() => setAgreed(!agreed)}>
        <View className={`agree-box ${agreed ? 'checked' : ''}`}>
          {agreed && <Text className='agree-tick'>✓</Text>}
        </View>
        <View className='agree-text'>
          <Text className='agree-plain'>我已阅读并同意</Text>
          <Text className='agree-link' onClick={(e) => { e.stopPropagation(); openProtocol('user') }}>《用户协议》</Text>
          <Text className='agree-plain'>和</Text>
          <Text className='agree-link' onClick={(e) => { e.stopPropagation(); openProtocol('privacy') }}>《隐私政策》</Text>
        </View>
      </View>
    </View>
  )
}
