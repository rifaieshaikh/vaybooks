import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type LicenseStatus =
  | 'success'
  | 'skipped'
  | 'in_cooling_period'
  | 'expired'
  | 'unknown';

export interface LicenseState {
  status: LicenseStatus;
}

const initialState: LicenseState = {
  status: 'unknown',
};

const licenseSlice = createSlice({
  name: 'license',
  initialState,
  reducers: {
    setLicenseStatus(state, action: PayloadAction<LicenseStatus>) {
      state.status = action.payload;
    },
  },
});

export const { setLicenseStatus } = licenseSlice.actions;
export default licenseSlice.reducer;
