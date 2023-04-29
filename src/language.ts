import { LanguageItemFunc, LanguageKeys, LanguageMapping } from 'languageModel';
import { en_us } from 'langs/en-us';

// Currently does not support multiple languages but this is some of the groundwork for that

const staticLanguage = en_us;
export const getCurrentLanguage: <K extends LanguageKeys, M extends LanguageMapping[K]>
    (key: K, data: M) => LanguageMapping = 
    <K extends LanguageKeys, M extends LanguageMapping[K]>
    (key: K, data: M) => (typeof(staticLanguage[key]) === 'string' ? staticLanguage[key] : (staticLanguage[key] as LanguageItemFunc)(data))