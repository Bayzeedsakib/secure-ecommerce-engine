interface QuantityControlProps {
  value: number
  max: number
  label: string
  disabled?: boolean
  onChange: (quantity: number) => void
}

export function QuantityControl({ value, max, label, disabled, onChange }: QuantityControlProps) {
  return (
    <div className="quantity" role="group" aria-label={`Quantity for ${label}`}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}
