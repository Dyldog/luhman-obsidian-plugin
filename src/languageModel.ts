export type LanguageItem = string | LanguageItemFunc
export type LanguageItemFunc = (data: LanguageItemFuncData) => string
export type LanguageItemFuncData = {[key: string]: string}


export enum LanguageKeys {
    checkSettingsMessage
}

export interface LanguageMapping extends LanguageMappingGeneric {
    [LanguageKeys.checkSettingsMessage]: string,
    "test": (data: LanguageItemFuncData) => string
}

type LanguageMappingGeneric = {[key: string]: LanguageItem }