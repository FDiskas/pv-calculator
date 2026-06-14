import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { type LanguageCode, setTranslateLanguage } from "../lib/translate";

const STORAGE_KEY = "lang";
const DEFAULT_LANG: LanguageCode = "lt";

/**
 * The vertimai `translate` singleton is created with its own default ("en").
 * We make Lithuanian the app default by switching the singleton at module load,
 * before the first (server) render — without touching translate.ts.
 */
setTranslateLanguage(DEFAULT_LANG);

type LanguageContextValue = {
	lang: LanguageCode;
	setLang: (lang: LanguageCode) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
	lang: DEFAULT_LANG,
	setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
	const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANG);

	// Restore the visitor's saved preference after hydration.
	useEffect(() => {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if ((stored === "lt" || stored === "en") && stored !== lang) {
			setTranslateLanguage(stored);
			setLangState(stored);
		}
	}, [lang]);

	const setLang = useCallback((next: LanguageCode) => {
		setTranslateLanguage(next);
		window.localStorage.setItem(STORAGE_KEY, next);
		setLangState(next);
	}, []);

	return (
		<LanguageContext.Provider value={{ lang, setLang }}>
			{children}
		</LanguageContext.Provider>
	);
}

export function useLanguage() {
	return useContext(LanguageContext);
}

const LANGUAGES: { code: LanguageCode; label: string }[] = [
	{ code: "lt", label: "Lietuvių" },
	{ code: "en", label: "English" },
];

export function LanguageSwitcher() {
	const { lang, setLang } = useLanguage();

	return (
		<div className="flex items-center gap-1 rounded-full border border-(--line-strong) bg-[rgba(8,14,27,0.6)] p-1">
			{LANGUAGES.map(({ code, label }) => {
				const active = code === lang;
				return (
					<button
						key={code}
						type="button"
						onClick={() => setLang(code)}
						aria-pressed={active}
						aria-label={label}
						title={label}
						className={
							active
								? "flex items-center gap-1.5 rounded-full bg-[rgba(42,212,255,0.14)] px-2.5 py-1 text-xs font-semibold text-(--elec-cyan) transition"
								: "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-(--ink-faint) transition hover:text-(--ink)"
						}
					>
						<span className="uppercase tracking-wide">{code}</span>
					</button>
				);
			})}
		</div>
	);
}
