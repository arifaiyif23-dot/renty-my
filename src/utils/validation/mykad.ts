export interface MyKadInfo {
  number: string;
  formatted: string;
  birthDate: Date;
  birthPlace: string;
  gender: 'male' | 'female';
  isValid: boolean;
  isMalaysianBorn: boolean;
}

const PLACE_CODES: Record<string, string> = {
  '01': 'Johor', '02': 'Johor', '21': 'Johor', '22': 'Johor',
  '03': 'Kedah', '23': 'Kedah',
  '04': 'Kelantan', '24': 'Kelantan',
  '05': 'Malacca', '25': 'Malacca',
  '06': 'Negeri Sembilan', '26': 'Negeri Sembilan',
  '07': 'Pahang', '27': 'Pahang',
  '08': 'Penang', '28': 'Penang',
  '09': 'Perak', '29': 'Perak',
  '10': 'Perlis', '30': 'Perlis',
  '11': 'Selangor', '31': 'Selangor',
  '12': 'Terengganu', '32': 'Terengganu',
  '13': 'Sabah', '33': 'Sabah',
  '14': 'Sarawak', '34': 'Sarawak',
  '15': 'Federal Territory (KL)', '35': 'Federal Territory (KL)',
  '16': 'Federal Territory (Putrajaya)', '36': 'Federal Territory (Putrajaya)',
  '57': 'Federal Territory (Labuan)',
  '59': 'Negeri Sembilan',
  '82': 'Sabah', '83': 'Sabah',
  '84': 'Sabah', '85': 'Sabah', '86': 'Sabah', '87': 'Sabah', '88': 'Sabah', '89': 'Sabah',
};

export function validateMyKad(input: string): MyKadInfo {
  const cleaned = input.replace(/\s|-/g, '');
  const pattern = /^(\d{6})(\d{2})(\d{2})(\d{4})$/;
  const match = cleaned.match(pattern);

  if (!match) {
    return {
      number: cleaned,
      formatted: input,
      birthDate: new Date(NaN),
      birthPlace: '',
      gender: 'male',
      isValid: false,
      isMalaysianBorn: false,
    };
  }

  const [, yyMMdd, pb, state, serial] = match;
  const day = parseInt(yyMMdd.substring(4, 6), 10);
  const month = parseInt(yyMMdd.substring(2, 4), 10) - 1;
  const yearBase = parseInt(yyMMdd.substring(0, 2), 10);
  const year = yearBase + (yearBase > 25 ? 1900 : 2000);
  const birthDate = new Date(year, month, day);

  const placeCode = pb + state;
  const birthPlace = PLACE_CODES[placeCode] || PLACE_CODES[pb] || 'Unknown';
  const gender = parseInt(serial, 10) % 2 === 0 ? 'female' : 'male';

  return {
    number: cleaned,
    formatted: `${yyMMdd}-${pb}-${state}-${serial}`,
    birthDate,
    birthPlace,
    gender,
    isValid: !isNaN(birthDate.getTime()),
    isMalaysianBorn: !!PLACE_CODES[pb],
  };
}
