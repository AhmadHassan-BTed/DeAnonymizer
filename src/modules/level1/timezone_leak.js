/**
 * Pinpoint Module: Timezone & Locale Profiler
 * Level 1: Standard Recon
 */
export default {
    id: 'timezone_leak',
    title: 'Timezone_Locale',
    level: 1,
    info: "Inspects client timezone, locale settings, and calendar preferences via standard Intl APIs.",
    steps: ["Query Date.getTimezoneOffset().", "Inspect Intl.DateTimeFormat().resolvedOptions().", "Collect navigator locale preferences."],
    run: async () => {
        const resolved = Intl.DateTimeFormat().resolvedOptions();
        return {
            timezone: resolved.timeZone,
            locale: resolved.locale,
            calendar: resolved.calendar,
            numberingSystem: resolved.numberingSystem,
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            languages: navigator.languages || [navigator.language]
        };
    }
};
