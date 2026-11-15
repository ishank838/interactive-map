import type { ReactNode } from 'react'

type RichTextProps = {
  text: string
  onOpenLocation?: (id: string) => void
}

const TOKEN = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\r?\n)/g

export function RichText({ text, onOpenLocation }: RichTextProps) {
  const parts: ReactNode[] = []
  let last = 0
  let key = 0
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('[')) {
      const parsed = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      const label = parsed?.[1] ?? token
      const href = parsed?.[2] ?? ''
      const locationId = /locationIds=(\d+)/.exec(href)?.[1]
      if (locationId && onOpenLocation) {
        parts.push(
          <button key={key} type="button" className="text-link" onClick={() => onOpenLocation(locationId)}>
            {label}
          </button>,
        )
      } else {
        parts.push(<span key={key}>{label}</span>)
      }
    } else {
      parts.push(<br key={key} />)
    }
    key += 1
    last = index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <div className="rich-text">{parts}</div>
}
