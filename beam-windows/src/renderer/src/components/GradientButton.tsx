import React from 'react'

interface Props {
  label: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

/** Primary CTA with the brand lime → teal gradient (Tempo GradientButton). */
export function GradientButton({ label, onClick, disabled, type = 'button' }: Props): React.JSX.Element {
  return (
    <button className="gbtn" onClick={onClick} disabled={disabled} type={type}>
      {label}
    </button>
  )
}
