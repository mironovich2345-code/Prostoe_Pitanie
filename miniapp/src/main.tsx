import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles.css'

// T1: JS bundle evaluated — time since T0 (inline script in index.html)
const _t0 = (window as any)._perf?.html ?? 0;
console.info(`[perf] T1 bundle +${(performance.now() - _t0).toFixed(0)}ms (html→bundle)`);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
