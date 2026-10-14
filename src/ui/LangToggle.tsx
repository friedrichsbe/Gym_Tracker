import { IconTranslate } from './icons'
import { setNameLang, useNameLang } from './lang'

/** Translate icon with the active language; tap to switch between English and German names. */
export function LangToggle() {
  const lang = useNameLang()
  return (
    <button
      type="button"
      className="btn ghost icon lang-btn"
      aria-label={lang === 'en' ? 'Show German names' : 'Show English names'}
      onClick={() => setNameLang(lang === 'en' ? 'de' : 'en')}
    >
      <IconTranslate />
      <span className="lang-code">{lang.toUpperCase()}</span>
    </button>
  )
}
