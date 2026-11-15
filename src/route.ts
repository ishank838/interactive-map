import { useEffect, useState } from 'react'

function normalize(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

export function useRoute() {
  const [path, setPath] = useState(() => normalize(window.location.pathname))

  useEffect(() => {
    const onPop = () => setPath(normalize(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function navigate(next: string) {
    const target = normalize(next)
    if (target === normalize(window.location.pathname)) return
    window.history.pushState(null, '', target)
    setPath(target)
  }

  return { path, navigate }
}
