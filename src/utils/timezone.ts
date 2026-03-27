export const CITY_TZ_MAP: Record<string, string> = {
  'москва': 'Europe/Moscow', 'московская': 'Europe/Moscow',
  'санкт-петербург': 'Europe/Moscow', 'петербург': 'Europe/Moscow', 'питер': 'Europe/Moscow', 'спб': 'Europe/Moscow',
  'екатеринбург': 'Asia/Yekaterinburg', 'екб': 'Asia/Yekaterinburg',
  'новосибирск': 'Asia/Novosibirsk', 'нск': 'Asia/Novosibirsk', 'новосиб': 'Asia/Novosibirsk',
  'красноярск': 'Asia/Krasnoyarsk',
  'омск': 'Asia/Omsk',
  'томск': 'Asia/Tomsk',
  'тюмень': 'Asia/Yekaterinburg',
  'пермь': 'Asia/Yekaterinburg',
  'уфа': 'Asia/Yekaterinburg',
  'челябинск': 'Asia/Yekaterinburg',
  'самара': 'Europe/Samara',
  'казань': 'Europe/Moscow',
  'нижний новгород': 'Europe/Moscow', 'нижний': 'Europe/Moscow', 'нн': 'Europe/Moscow',
  'воронеж': 'Europe/Moscow',
  'ростов-на-дону': 'Europe/Moscow', 'ростов': 'Europe/Moscow',
  'краснодар': 'Europe/Moscow',
  'волгоград': 'Europe/Moscow',
  'саратов': 'Europe/Moscow',
  'ставрополь': 'Europe/Moscow',
  'иркутск': 'Asia/Irkutsk',
  'якутск': 'Asia/Yakutsk',
  'хабаровск': 'Asia/Vladivostok',
  'владивосток': 'Asia/Vladivostok', 'вла': 'Asia/Vladivostok', 'владик': 'Asia/Vladivostok',
  'южно-сахалинск': 'Asia/Sakhalin', 'сахалин': 'Asia/Sakhalin',
  'магадан': 'Asia/Magadan',
  'петропавловск-камчатский': 'Asia/Kamchatka', 'камчатка': 'Asia/Kamchatka',
  'калининград': 'Europe/Kaliningrad',
  'минск': 'Europe/Minsk',
  'киев': 'Europe/Kiev',
  'алматы': 'Asia/Almaty', 'алма-ата': 'Asia/Almaty', 'астана': 'Asia/Almaty', 'нур-султан': 'Asia/Almaty',
  'ташкент': 'Asia/Tashkent',
  'баку': 'Asia/Baku',
  'ереван': 'Asia/Yerevan',
  'тбилиси': 'Asia/Tbilisi',
  'барнаул': 'Asia/Barnaul',
  'кемерово': 'Asia/Novokuznetsk', 'новокузнецк': 'Asia/Novokuznetsk',
  'чита': 'Asia/Chita',
  'астрахань': 'Europe/Astrakhan',
};

export function resolveTimezone(city: string): string | null {
  const key = city.toLowerCase().trim();
  if (CITY_TZ_MAP[key]) return CITY_TZ_MAP[key];
  for (const [name, tz] of Object.entries(CITY_TZ_MAP)) {
    if (key.includes(name) || name.includes(key)) return tz;
  }
  return null;
}
