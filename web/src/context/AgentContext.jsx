import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const AgentContext = createContext({
  context: {},
  setAgentContext: () => {},
  mergeAgentContext: () => {},
})

export function AgentContextProvider({ children }) {
  const [context, setContext] = useState({})

  const setAgentContext = useCallback((next) => {
    setContext(next || {})
  }, [])

  const mergeAgentContext = useCallback((patch) => {
    setContext((prev) => ({ ...prev, ...patch }))
  }, [])

  const value = useMemo(
    () => ({ context, setAgentContext, mergeAgentContext }),
    [context, setAgentContext, mergeAgentContext],
  )

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

export function useAgentContext() {
  return useContext(AgentContext)
}
