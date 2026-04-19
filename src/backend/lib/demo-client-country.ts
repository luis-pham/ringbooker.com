/**
 * Demo admin: infer ISO 3166-1 alpha-2 from callback E.164 when CF-IPCountry is missing.
 * NANP (+1): Caribbean NPAs map to their territory; known Canada NPAs → CA; else US.
 */

/** ITU calling prefixes (digits only, no leading +), longest match wins. Excludes standalone "1" (handled by NANP). */
const E164_PREFIX_TO_CC: Array<{ prefix: string; cc: string }> = [
  { prefix: '1242', cc: 'BS' },
  { prefix: '1246', cc: 'BB' },
  { prefix: '1264', cc: 'AI' },
  { prefix: '1268', cc: 'AG' },
  { prefix: '1284', cc: 'VG' },
  { prefix: '1340', cc: 'VI' },
  { prefix: '1345', cc: 'KY' },
  { prefix: '1441', cc: 'BM' },
  { prefix: '1473', cc: 'GD' },
  { prefix: '1649', cc: 'TC' },
  { prefix: '1664', cc: 'MS' },
  { prefix: '1670', cc: 'MP' },
  { prefix: '1671', cc: 'GU' },
  { prefix: '1684', cc: 'AS' },
  { prefix: '1758', cc: 'LC' },
  { prefix: '1767', cc: 'DM' },
  { prefix: '1784', cc: 'VC' },
  { prefix: '1787', cc: 'PR' },
  { prefix: '1809', cc: 'DO' },
  { prefix: '1829', cc: 'DO' },
  { prefix: '1849', cc: 'DO' },
  { prefix: '1868', cc: 'TT' },
  { prefix: '1869', cc: 'KN' },
  { prefix: '1876', cc: 'JM' },
  { prefix: '1939', cc: 'PR' },
  { prefix: '290', cc: 'SH' },
  { prefix: '291', cc: 'ER' },
  { prefix: '297', cc: 'AW' },
  { prefix: '298', cc: 'FO' },
  { prefix: '299', cc: 'GL' },
  { prefix: '350', cc: 'GI' },
  { prefix: '351', cc: 'PT' },
  { prefix: '352', cc: 'LU' },
  { prefix: '353', cc: 'IE' },
  { prefix: '354', cc: 'IS' },
  { prefix: '355', cc: 'AL' },
  { prefix: '356', cc: 'MT' },
  { prefix: '357', cc: 'CY' },
  { prefix: '358', cc: 'FI' },
  { prefix: '359', cc: 'BG' },
  { prefix: '370', cc: 'LT' },
  { prefix: '371', cc: 'LV' },
  { prefix: '372', cc: 'EE' },
  { prefix: '373', cc: 'MD' },
  { prefix: '374', cc: 'AM' },
  { prefix: '375', cc: 'BY' },
  { prefix: '376', cc: 'AD' },
  { prefix: '377', cc: 'MC' },
  { prefix: '378', cc: 'SM' },
  { prefix: '380', cc: 'UA' },
  { prefix: '381', cc: 'RS' },
  { prefix: '382', cc: 'ME' },
  { prefix: '383', cc: 'XK' },
  { prefix: '385', cc: 'HR' },
  { prefix: '386', cc: 'SI' },
  { prefix: '387', cc: 'BA' },
  { prefix: '389', cc: 'MK' },
  { prefix: '420', cc: 'CZ' },
  { prefix: '421', cc: 'SK' },
  { prefix: '423', cc: 'LI' },
  { prefix: '500', cc: 'FK' },
  { prefix: '501', cc: 'BZ' },
  { prefix: '502', cc: 'GT' },
  { prefix: '503', cc: 'SV' },
  { prefix: '504', cc: 'HN' },
  { prefix: '505', cc: 'NI' },
  { prefix: '506', cc: 'CR' },
  { prefix: '507', cc: 'PA' },
  { prefix: '508', cc: 'PM' },
  { prefix: '509', cc: 'HT' },
  { prefix: '590', cc: 'GP' },
  { prefix: '591', cc: 'BO' },
  { prefix: '592', cc: 'GY' },
  { prefix: '593', cc: 'EC' },
  { prefix: '594', cc: 'GF' },
  { prefix: '595', cc: 'PY' },
  { prefix: '596', cc: 'MQ' },
  { prefix: '597', cc: 'SR' },
  { prefix: '598', cc: 'UY' },
  { prefix: '599', cc: 'CW' },
  { prefix: '670', cc: 'TL' },
  { prefix: '672', cc: 'NF' },
  { prefix: '673', cc: 'BN' },
  { prefix: '674', cc: 'NR' },
  { prefix: '675', cc: 'PG' },
  { prefix: '676', cc: 'TO' },
  { prefix: '677', cc: 'SB' },
  { prefix: '678', cc: 'VU' },
  { prefix: '679', cc: 'FJ' },
  { prefix: '680', cc: 'PW' },
  { prefix: '681', cc: 'WF' },
  { prefix: '682', cc: 'CK' },
  { prefix: '683', cc: 'NU' },
  { prefix: '685', cc: 'WS' },
  { prefix: '686', cc: 'KI' },
  { prefix: '687', cc: 'NC' },
  { prefix: '688', cc: 'TV' },
  { prefix: '689', cc: 'PF' },
  { prefix: '690', cc: 'TK' },
  { prefix: '691', cc: 'FM' },
  { prefix: '692', cc: 'MH' },
  { prefix: '850', cc: 'KP' },
  { prefix: '852', cc: 'HK' },
  { prefix: '853', cc: 'MO' },
  { prefix: '855', cc: 'KH' },
  { prefix: '856', cc: 'LA' },
  { prefix: '880', cc: 'BD' },
  { prefix: '886', cc: 'TW' },
  { prefix: '960', cc: 'MV' },
  { prefix: '961', cc: 'LB' },
  { prefix: '962', cc: 'JO' },
  { prefix: '963', cc: 'SY' },
  { prefix: '964', cc: 'IQ' },
  { prefix: '965', cc: 'KW' },
  { prefix: '966', cc: 'SA' },
  { prefix: '967', cc: 'YE' },
  { prefix: '968', cc: 'OM' },
  { prefix: '970', cc: 'PS' },
  { prefix: '971', cc: 'AE' },
  { prefix: '972', cc: 'IL' },
  { prefix: '973', cc: 'BH' },
  { prefix: '974', cc: 'QA' },
  { prefix: '975', cc: 'BT' },
  { prefix: '976', cc: 'MN' },
  { prefix: '977', cc: 'NP' },
  { prefix: '992', cc: 'TJ' },
  { prefix: '993', cc: 'TM' },
  { prefix: '994', cc: 'AZ' },
  { prefix: '995', cc: 'GE' },
  { prefix: '996', cc: 'KG' },
  { prefix: '998', cc: 'UZ' },
  { prefix: '20', cc: 'EG' },
  { prefix: '27', cc: 'ZA' },
  { prefix: '30', cc: 'GR' },
  { prefix: '31', cc: 'NL' },
  { prefix: '32', cc: 'BE' },
  { prefix: '33', cc: 'FR' },
  { prefix: '34', cc: 'ES' },
  { prefix: '36', cc: 'HU' },
  { prefix: '39', cc: 'IT' },
  { prefix: '40', cc: 'RO' },
  { prefix: '41', cc: 'CH' },
  { prefix: '43', cc: 'AT' },
  { prefix: '44', cc: 'GB' },
  { prefix: '45', cc: 'DK' },
  { prefix: '46', cc: 'SE' },
  { prefix: '47', cc: 'NO' },
  { prefix: '48', cc: 'PL' },
  { prefix: '49', cc: 'DE' },
  { prefix: '51', cc: 'PE' },
  { prefix: '52', cc: 'MX' },
  { prefix: '53', cc: 'CU' },
  { prefix: '54', cc: 'AR' },
  { prefix: '55', cc: 'BR' },
  { prefix: '56', cc: 'CL' },
  { prefix: '57', cc: 'CO' },
  { prefix: '58', cc: 'VE' },
  { prefix: '60', cc: 'MY' },
  { prefix: '61', cc: 'AU' },
  { prefix: '62', cc: 'ID' },
  { prefix: '63', cc: 'PH' },
  { prefix: '64', cc: 'NZ' },
  { prefix: '65', cc: 'SG' },
  { prefix: '66', cc: 'TH' },
  { prefix: '81', cc: 'JP' },
  { prefix: '82', cc: 'KR' },
  { prefix: '84', cc: 'VN' },
  { prefix: '86', cc: 'CN' },
  { prefix: '90', cc: 'TR' },
  { prefix: '91', cc: 'IN' },
  { prefix: '92', cc: 'PK' },
  { prefix: '93', cc: 'AF' },
  { prefix: '94', cc: 'LK' },
  { prefix: '95', cc: 'MM' },
  { prefix: '98', cc: 'IR' },
];

const NANP_CARIBBEAN_NPA: Record<string, string> = {
  '670': 'MP',
  '242': 'BS',
  '246': 'BB',
  '264': 'AI',
  '268': 'AG',
  '284': 'VG',
  '340': 'VI',
  '345': 'KY',
  '441': 'BM',
  '473': 'GD',
  '649': 'TC',
  '664': 'MS',
  '671': 'GU',
  '684': 'AS',
  '758': 'LC',
  '767': 'DM',
  '784': 'VC',
  '787': 'PR',
  '809': 'DO',
  '829': 'DO',
  '849': 'DO',
  '868': 'TT',
  '869': 'KN',
  '876': 'JM',
  '939': 'PR',
};

/** Common Canada NPAs (NANP); US gets default when not listed and not Caribbean. */
const NANP_CANADA_NPA = new Set<string>([
  '204',
  '226',
  '236',
  '249',
  '250',
  '263',
  '289',
  '306',
  '343',
  '354',
  '365',
  '367',
  '368',
  '382',
  '403',
  '416',
  '418',
  '428',
  '431',
  '437',
  '438',
  '450',
  '468',
  '474',
  '506',
  '514',
  '519',
  '548',
  '579',
  '581',
  '584',
  '587',
  '604',
  '613',
  '639',
  '647',
  '672',
  '683',
  '705',
  '709',
  '742',
  '753',
  '778',
  '780',
  '782',
  '807',
  '819',
  '825',
  '867',
  '873',
  '879',
  '902',
  '905',
]);

function inferNanpCountry(digits: string): string | null {
  if (!digits.startsWith('1') || digits.length < 11) return null;
  const npa = digits.slice(1, 4);
  const car = NANP_CARIBBEAN_NPA[npa];
  if (car) return car;
  if (NANP_CANADA_NPA.has(npa)) return 'CA';
  return 'US';
}

/**
 * Best-effort ISO2 from E.164 (+...). Returns null if unknown / invalid.
 */
export function inferCountryFromE164(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const trimmed = e164.trim();
  if (!trimmed.startsWith('+')) return null;
  const digits = trimmed.slice(1).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;

  if (digits.startsWith('1')) {
    return inferNanpCountry(digits);
  }

  for (const { prefix, cc } of E164_PREFIX_TO_CC) {
    if (digits.startsWith(prefix)) return cc;
  }

  return null;
}

/**
 * Persisted value: Cloudflare / proxy country first, else phone-derived.
 * `cfCountry` should already be normalized (e.g. A-Z two letters or null).
 */
export function resolveDemoClientCountryForPersistence(cfCountry: string | null | undefined, callbackPhoneE164: string): string | null {
  const fromCf = (cfCountry ?? '').trim().toUpperCase();
  if (fromCf.length === 2 && /^[A-Z]{2}$/.test(fromCf) && fromCf !== 'XX' && fromCf !== 'T1') {
    return fromCf;
  }
  return inferCountryFromE164(callbackPhoneE164);
}

/**
 * Admin list: show stored country, or infer from callback when legacy rows have null.
 */
export function effectiveDemoClientCountry(storedCountry: string | null | undefined, callbackPhoneE164: string): string | null {
  const s = (storedCountry ?? '').trim().toUpperCase();
  if (s.length === 2 && /^[A-Z]{2}$/.test(s) && s !== 'XX' && s !== 'T1') return s;
  return inferCountryFromE164(callbackPhoneE164);
}
