// Reusable Formik-aware set of optional student profile fields.
// Used by RegisterPage, NewUserPage, EditUserPage, and ProfilePage so the
// same 7 inputs (fatherName, province, district, studentClass, studentStatus,
// fscCollegeName, fscBoard) render consistently — change the markup once, all
// four forms update.
//
// Two style variants:
//   • variant="brand"  → tall pill inputs with brand styling (auth pages)
//   • variant="simple" → compact inputs that match admin forms
//
// Districts are dependent on province; when the selected province has no
// preset list (or the user picks "Other"), a free-text district input is
// shown instead. Sindh is the default if the user has no province set yet.

import React from 'react';
import { Field, useFormikContext } from 'formik';
import {
  PROVINCES,
  DISTRICTS_BY_PROVINCE,
  STUDENT_CLASSES,
  STUDENT_STATUSES,
} from '../constants/studentProfile';

const StudentProfileFields = ({ variant = 'simple', title = 'Additional info (optional)' }) => {
  const { values, setFieldValue } = useFormikContext();
  const province = values.province || '';
  const districts = DISTRICTS_BY_PROVINCE[province] || [];
  const districtIsCustom = !!province && !districts.includes(values.district) && values.district !== '';
  // "Other" mode: user picked Other OR the saved district isn't in the
  // current province's preset list. Either way, show a free-text input.
  const showCustomDistrict = districtIsCustom || values.district === '__OTHER__';

  // When province changes, reset district so we don't carry a Karachi value
  // into a freshly-picked Punjab. Touching the radio without picking is fine.
  const onProvinceChange = (e) => {
    setFieldValue('province', e.target.value);
    setFieldValue('district', '');
  };

  // ─── Style classes per variant ────────────────────────────────────────────
  const inputCls = variant === 'brand'
    ? 'w-full px-3 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition'
    : 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
  const labelCls = variant === 'brand'
    ? 'block text-xs font-bold text-gray-900 mb-1.5'
    : 'block text-sm font-medium text-gray-700 mb-1';
  const sectionTitleCls = variant === 'brand'
    ? 'text-xs font-bold text-gray-500 uppercase tracking-wider mt-4 mb-1'
    : 'text-base font-bold text-gray-800 mb-4 mt-6';

  return (
    <>
      {title && <h3 className={sectionTitleCls}>{title}</h3>}

      {/* Father Name */}
      <div>
        <label htmlFor="fatherName" className={labelCls}>Father Name</label>
        <Field id="fatherName" name="fatherName" type="text" className={inputCls} placeholder="As on ID card" />
      </div>

      {/* Province + District */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="province" className={labelCls}>Province</label>
          <Field as="select" id="province" name="province" className={inputCls} onChange={onProvinceChange}>
            <option value="">— Select —</option>
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Field>
        </div>

        <div>
          <label htmlFor="district" className={labelCls}>District</label>
          {!province && (
            <Field id="district" name="district" type="text" className={inputCls} placeholder="Pick a province first" disabled />
          )}
          {province && !showCustomDistrict && (
            <Field
              as="select"
              id="district"
              name="district"
              className={inputCls}
              onChange={(e) => {
                if (e.target.value === 'Other') {
                  // Switch to free-text mode by clearing the value; the input
                  // below will appear on the next render via showCustomDistrict.
                  setFieldValue('district', '__OTHER__');
                } else {
                  setFieldValue('district', e.target.value);
                }
              }}
            >
              <option value="">— Select —</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </Field>
          )}
          {province && showCustomDistrict && (
            <div className="space-y-1">
              <Field
                id="district"
                name="district"
                type="text"
                className={inputCls}
                placeholder="Type district name"
                value={values.district === '__OTHER__' ? '' : values.district}
                onChange={(e) => setFieldValue('district', e.target.value)}
              />
              <button
                type="button"
                onClick={() => setFieldValue('district', '')}
                className="text-xs text-blue-600 hover:underline"
              >
                ← Back to district list
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Class + Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="studentClass" className={labelCls}>Class</label>
          <Field as="select" id="studentClass" name="studentClass" className={inputCls}>
            <option value="">— Select —</option>
            {STUDENT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Field>
        </div>
        <div>
          <label htmlFor="studentStatus" className={labelCls}>Status</label>
          <Field as="select" id="studentStatus" name="studentStatus" className={inputCls}>
            <option value="">— Select —</option>
            {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Field>
        </div>
      </div>

      {/* FSC College + Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fscCollegeName" className={labelCls}>FSC College Name</label>
          <Field id="fscCollegeName" name="fscCollegeName" type="text" className={inputCls} placeholder="e.g. Adamjee Govt. Science College" />
        </div>
        <div>
          <label htmlFor="fscBoard" className={labelCls}>FSC Board</label>
          <Field id="fscBoard" name="fscBoard" type="text" className={inputCls} placeholder="e.g. BIEK Karachi" />
        </div>
      </div>
    </>
  );
};

export default StudentProfileFields;
