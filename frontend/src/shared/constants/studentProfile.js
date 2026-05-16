// Shared option sets for the optional student profile fields.
// Used by RegisterPage, NewUserPage, EditUserPage, and ProfilePage so all
// forms show the exact same choices. Keep the values in sync with the enum
// validators on backend/models/User.js (province, studentClass, studentStatus).

export const PROVINCES = [
  'Punjab',
  'KPK',
  'Sindh',
  'Balochistan',
  'AJK',
  'Gilgit Baltistan',
];

export const DEFAULT_PROVINCE = 'Sindh';

// District lists per province. Sourced from the official administrative
// divisions of Pakistan. Each list ends with 'Other' so users in newer or
// uncommon districts can free-text their location via a secondary input
// (see studentClass enum below — only 'Other' triggers the text fallback).
export const DISTRICTS_BY_PROVINCE = {
  Sindh: [
    'Badin', 'Dadu', 'Ghotki', 'Hyderabad', 'Jacobabad', 'Jamshoro',
    'Karachi Central', 'Karachi East', 'Karachi South', 'Karachi West',
    'Korangi', 'Kemari', 'Kashmore', 'Khairpur', 'Larkana', 'Matiari',
    'Mirpurkhas', 'Naushahro Feroze', 'Shaheed Benazirabad (Nawabshah)',
    'Qambar Shahdadkot', 'Sanghar', 'Shikarpur', 'Sukkur', 'Sujawal',
    'Tando Allahyar', 'Tando Muhammad Khan', 'Tharparkar', 'Thatta',
    'Umerkot', 'Malir',
    'Other',
  ],
  Punjab: [
    'Attock', 'Bahawalnagar', 'Bahawalpur', 'Bhakkar', 'Chakwal', 'Chiniot',
    'Dera Ghazi Khan', 'Faisalabad', 'Gujranwala', 'Gujrat', 'Hafizabad',
    'Jhang', 'Jhelum', 'Kasur', 'Khanewal', 'Khushab', 'Lahore', 'Layyah',
    'Lodhran', 'Mandi Bahauddin', 'Mianwali', 'Multan', 'Muzaffargarh',
    'Nankana Sahib', 'Narowal', 'Okara', 'Pakpattan', 'Rahim Yar Khan',
    'Rajanpur', 'Rawalpindi', 'Sahiwal', 'Sargodha', 'Sheikhupura',
    'Sialkot', 'Toba Tek Singh', 'Vehari',
    'Other',
  ],
  KPK: [
    'Abbottabad', 'Bajaur', 'Bannu', 'Battagram', 'Buner', 'Charsadda',
    'Chitral Lower', 'Chitral Upper', 'Dera Ismail Khan', 'Dir Lower',
    'Dir Upper', 'Hangu', 'Haripur', 'Karak', 'Khyber', 'Kohat',
    'Kohistan Lower', 'Kohistan Upper', 'Kolai-Palas', 'Kurram',
    'Lakki Marwat', 'Malakand', 'Mansehra', 'Mardan', 'Mohmand',
    'North Waziristan', 'Nowshera', 'Orakzai', 'Peshawar', 'Shangla',
    'South Waziristan Lower', 'South Waziristan Upper', 'Swabi', 'Swat',
    'Tank', 'Torghar',
    'Other',
  ],
  Balochistan: [
    'Awaran', 'Barkhan', 'Chagai', 'Chaman', 'Dera Bugti', 'Dukki',
    'Gwadar', 'Harnai', 'Hub', 'Jafarabad', 'Jhal Magsi', 'Kachhi',
    'Kalat', 'Kech (Turbat)', 'Kharan', 'Khuzdar', 'Killa Abdullah',
    'Killa Saifullah', 'Kohlu', 'Lasbela', 'Loralai', 'Mastung',
    'Musakhel', 'Nasirabad', 'Nushki', 'Panjgur', 'Pishin', 'Quetta',
    'Sherani', 'Shaheed Sikandarabad', 'Sibi', 'Sohbatpur', 'Surab',
    'Washuk', 'Zhob', 'Ziarat',
    'Other',
  ],
  AJK: [
    'Bagh', 'Bhimber', 'Hattian Bala', 'Haveli', 'Kotli', 'Mirpur',
    'Muzaffarabad', 'Neelum', 'Poonch (Rawalakot)', 'Sudhanoti',
    'Other',
  ],
  'Gilgit Baltistan': [
    'Astore', 'Diamer', 'Ghanche', 'Ghizer', 'Gilgit', 'Gupis-Yasin',
    'Hunza', 'Kharmang', 'Nagar', 'Roundu', 'Shigar', 'Skardu',
    'Tangir', 'Darel',
    'Other',
  ],
};

export const STUDENT_CLASSES = ['XI', 'XII', 'FSC Completed'];
export const STUDENT_STATUSES = ['Fresher', 'Repeater'];

// Initial empty state for the 7 optional fields. Spread into Formik
// initialValues alongside other user fields.
export const EMPTY_STUDENT_PROFILE = {
  fatherName:     '',
  province:       '',
  district:       '',
  studentClass:   '',
  studentStatus:  '',
  fscCollegeName: '',
  fscBoard:       '',
};
