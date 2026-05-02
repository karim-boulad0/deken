import { useEffect, useRef, useState, useId } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import './SearchableSelect.css'

export type SelectOption = {
  id: string
  name: string
}

type Props = {
  options: SelectOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  required?: boolean
  searchPlaceholder?: string
  noResultsText?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '',
  disabled = false,
  id: providedId,
  className = '',
  required = false,
  searchPlaceholder = 'Search...',
  noResultsText = 'No results found'
}: Props) {
  const internalId = useId()
  const id = providedId || internalId
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.id === value)
  const filteredOptions = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      inputRef.current?.focus()
    }
  }, [isOpen])

  const handleSelect = (option: SelectOption | null) => {
    onChange(option ? option.id : null)
    setIsOpen(false)
    setSearch('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`ss-container ${className} ${disabled ? 'ss-disabled' : ''} ${isOpen ? 'ss-open' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <div
        className="ss-display"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        id={id}
      >
        <span className={`ss-value ${!selectedOption ? 'ss-placeholder' : ''}`}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <div className="ss-icons">
          {value && !disabled && (
            <button
              type="button"
              className="ss-clear"
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(null)
              }}
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={`ss-chevron ${isOpen ? 'ss-chevron--open' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="ss-dropdown">
          <div className="ss-search-box">
            <Search size={14} className="ss-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="ss-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
            />
          </div>
          <div ref={listRef} className="ss-list" role="listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className={`ss-option ${option.id === value ? 'ss-option--selected' : ''}`}
                  onClick={() => handleSelect(option)}
                  role="option"
                  aria-selected={option.id === value}
                >
                  {option.name}
                </div>
              ))
            ) : (
              <div className="ss-no-results">{noResultsText}</div>
            )}
          </div>
        </div>
      )}
      
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', height: 0, width: 0 }}
          value={value || ''}
          required
          onChange={() => {}}
        />
      )}
    </div>
  )
}
