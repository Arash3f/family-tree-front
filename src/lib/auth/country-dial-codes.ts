/** Dial codes for the public sign-up country picker. */

export type DialCode = {
  code: string;
  nameEn: string;
  nameFa: string;
};

export const DEFAULT_DIAL_CODE = "+98";

export const DIAL_CODES: DialCode[] = [
  { code: "+93", nameEn: "Afghanistan", nameFa: "افغانستان" },
  { code: "+355", nameEn: "Albania", nameFa: "آلبانی" },
  { code: "+213", nameEn: "Algeria", nameFa: "الجزایر" },
  { code: "+54", nameEn: "Argentina", nameFa: "آرژانتین" },
  { code: "+61", nameEn: "Australia", nameFa: "استرالیا" },
  { code: "+43", nameEn: "Austria", nameFa: "اتریش" },
  { code: "+994", nameEn: "Azerbaijan", nameFa: "جمهوری آذربایجان" },
  { code: "+973", nameEn: "Bahrain", nameFa: "بحرین" },
  { code: "+880", nameEn: "Bangladesh", nameFa: "بنگلادش" },
  { code: "+32", nameEn: "Belgium", nameFa: "بلژیک" },
  { code: "+55", nameEn: "Brazil", nameFa: "برزیل" },
  { code: "+359", nameEn: "Bulgaria", nameFa: "بلغارستان" },
  { code: "+1", nameEn: "Canada / USA", nameFa: "کانادا / آمریکا" },
  { code: "+86", nameEn: "China", nameFa: "چین" },
  { code: "+57", nameEn: "Colombia", nameFa: "کلمبیا" },
  { code: "+385", nameEn: "Croatia", nameFa: "کرواسی" },
  { code: "+357", nameEn: "Cyprus", nameFa: "قبرس" },
  { code: "+420", nameEn: "Czechia", nameFa: "چک" },
  { code: "+45", nameEn: "Denmark", nameFa: "دانمارک" },
  { code: "+20", nameEn: "Egypt", nameFa: "مصر" },
  { code: "+372", nameEn: "Estonia", nameFa: "استونی" },
  { code: "+358", nameEn: "Finland", nameFa: "فنلاند" },
  { code: "+33", nameEn: "France", nameFa: "فرانسه" },
  { code: "+49", nameEn: "Germany", nameFa: "آلمان" },
  { code: "+30", nameEn: "Greece", nameFa: "یونان" },
  { code: "+852", nameEn: "Hong Kong", nameFa: "هنگ‌کنگ" },
  { code: "+36", nameEn: "Hungary", nameFa: "مجارستان" },
  { code: "+91", nameEn: "India", nameFa: "هند" },
  { code: "+62", nameEn: "Indonesia", nameFa: "اندونزی" },
  { code: "+98", nameEn: "Iran", nameFa: "ایران" },
  { code: "+964", nameEn: "Iraq", nameFa: "عراق" },
  { code: "+353", nameEn: "Ireland", nameFa: "ایرلند" },
  { code: "+972", nameEn: "Israel", nameFa: "اسرائیل" },
  { code: "+39", nameEn: "Italy", nameFa: "ایتالیا" },
  { code: "+81", nameEn: "Japan", nameFa: "ژاپن" },
  { code: "+962", nameEn: "Jordan", nameFa: "اردن" },
  { code: "+7", nameEn: "Kazakhstan / Russia", nameFa: "قزاقستان / روسیه" },
  { code: "+965", nameEn: "Kuwait", nameFa: "کویت" },
  { code: "+961", nameEn: "Lebanon", nameFa: "لبنان" },
  { code: "+60", nameEn: "Malaysia", nameFa: "مالزی" },
  { code: "+52", nameEn: "Mexico", nameFa: "مکزیک" },
  { code: "+212", nameEn: "Morocco", nameFa: "مراکش" },
  { code: "+31", nameEn: "Netherlands", nameFa: "هلند" },
  { code: "+64", nameEn: "New Zealand", nameFa: "نیوزیلند" },
  { code: "+234", nameEn: "Nigeria", nameFa: "نیجریه" },
  { code: "+47", nameEn: "Norway", nameFa: "نروژ" },
  { code: "+968", nameEn: "Oman", nameFa: "عمان" },
  { code: "+92", nameEn: "Pakistan", nameFa: "پاکستان" },
  { code: "+970", nameEn: "Palestine", nameFa: "فلسطین" },
  { code: "+48", nameEn: "Poland", nameFa: "لهستان" },
  { code: "+351", nameEn: "Portugal", nameFa: "پرتغال" },
  { code: "+974", nameEn: "Qatar", nameFa: "قطر" },
  { code: "+40", nameEn: "Romania", nameFa: "رومانی" },
  { code: "+966", nameEn: "Saudi Arabia", nameFa: "عربستان سعودی" },
  { code: "+381", nameEn: "Serbia", nameFa: "صربستان" },
  { code: "+65", nameEn: "Singapore", nameFa: "سنگاپور" },
  { code: "+27", nameEn: "South Africa", nameFa: "آفریقای جنوبی" },
  { code: "+82", nameEn: "South Korea", nameFa: "کره جنوبی" },
  { code: "+34", nameEn: "Spain", nameFa: "اسپانیا" },
  { code: "+46", nameEn: "Sweden", nameFa: "سوئد" },
  { code: "+41", nameEn: "Switzerland", nameFa: "سوئیس" },
  { code: "+963", nameEn: "Syria", nameFa: "سوریه" },
  { code: "+886", nameEn: "Taiwan", nameFa: "تایوان" },
  { code: "+66", nameEn: "Thailand", nameFa: "تایلند" },
  { code: "+90", nameEn: "Turkey", nameFa: "ترکیه" },
  { code: "+971", nameEn: "United Arab Emirates", nameFa: "امارات متحده عربی" },
  { code: "+44", nameEn: "United Kingdom", nameFa: "بریتانیا" },
  { code: "+380", nameEn: "Ukraine", nameFa: "اوکراین" },
  { code: "+998", nameEn: "Uzbekistan", nameFa: "ازبکستان" },
  { code: "+84", nameEn: "Vietnam", nameFa: "ویتنام" },
  { code: "+967", nameEn: "Yemen", nameFa: "یمن" },
];

export function dialCodeLabel(entry: DialCode, locale: string): string {
  const name = locale.startsWith("fa") ? entry.nameFa : entry.nameEn;
  return `${entry.code} · ${name}`;
}
