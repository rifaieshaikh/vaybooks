import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface SessionState {
  userId: string | null;
  displayName: string | null;
  workingLocationId: string | null;
  accessToken: string | null;
}

const initialState: SessionState = {
  userId: null,
  displayName: null,
  workingLocationId: null,
  accessToken: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{
        userId: string;
        displayName: string;
        workingLocationId?: string;
        accessToken: string;
      }>,
    ) {
      state.userId = action.payload.userId;
      state.displayName = action.payload.displayName;
      state.workingLocationId = action.payload.workingLocationId ?? null;
      state.accessToken = action.payload.accessToken;
    },
    clearSession(state) {
      state.userId = null;
      state.displayName = null;
      state.workingLocationId = null;
      state.accessToken = null;
    },
  },
});

export const { setSession, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
