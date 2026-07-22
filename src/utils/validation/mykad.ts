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
  '01': 'Johor', '21': 'Johor',
  '02': 'Kedah', '22': 'Kedah',
  '03': 'Kelantan', '23': 'Kelantan',
  '04': 'Melaka', '24': 'Melaka',
  '05': 'Negeri Sembilan', '25': 'Negeri Sembilan',
  '06': 'Pahang', '26': 'Pahang',
  '07': 'Pulau Pinang', '27': 'Pulau Pinang',
  '08': 'Perak', '28': 'Perak',
  '09': 'Perlis', '29': 'Perlis',
  '10': 'Selangor', '30': 'Selangor',
  '11': 'Terengganu', '31': 'Terengganu',
  '12': 'Sabah', '32': 'Sabah',
  '13': 'Sarawak', '33': 'Sarawak',
  '14': 'WP Kuala Lumpur', '34': 'WP Kuala Lumpur',
  '15': 'WP Labuan', '35': 'WP Labuan',
  '16': 'WP Putrajaya', '36': 'WP Putrajaya',
  '57': 'WP Labuan',
  '59': 'Negeri Sembilan',
  '82': 'Sabah', '83': 'Sabah', '84': 'Sabah', '85': 'Sabah',
  '86': 'Sabah', '87': 'Sabah', '88': 'Sabah', '89': 'Sabah',
};

export function validateMyKad(input: string): MyKadInfo {
  const cleaned = input.replace(/\s|-/g, '');
  if (cleaned.length !== 12) {
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

  const pattern = /^(\d{6})(\d{2})(\d{4})$/;
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

  const [, yyMMdd, pb, serial] = match;
  const day = parseInt(yyMMdd.substring(4, 6), 10);
  const month = parseInt(yyMMdd.substring(2, 4), 10) - 1;
  const yearBase = parseInt(yyMMdd.substring(0, 2), 10);
  const year = yearBase + (yearBase > 25 ? 1900 : 2000);
  const birthDate = new Date(year, month, day);

  if (birthDate.getDate() !== day || birthDate.getMonth() !== month) {
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

  const birthPlace = PLACE_CODES[pb] || 'Unknown';
  const gender = parseInt(serial, 10) % 2 === 0 ? 'female' : 'male';

  return {
    number: cleaned,
    formatted: `${yyMMdd}-${pb}-${serial}`,
    birthDate,
    birthPlace,
    gender,
    isValid: !isNaN(birthDate.getTime()),
    isMalaysianBorn: !!PLACE_CODES[pb],
  };
}
