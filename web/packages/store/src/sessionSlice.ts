import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const SESSION_STORAGE_KEY = 'vaybooks.session.v1';

export interface SessionState {
  userId: string | null;
  displayName: string | null;
  workingLocationId: string | null;
  accessToken: string | null;
}

function loadPersisted(): SessionState {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return {
        userId: null,
        displayName: null,
        workingLocationId: null,
        accessToken: null,
      };
    }
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return {
      userId: parsed.userId ?? null,
      displayName: parsed.displayName ?? null,
      workingLocationId: parsed.workingLocationId ?? null,
      accessToken: parsed.accessToken ?? null,
    };
  } catch {
    return {
      userId: null,
      displayName: null,
      workingLocationId: null,
      accessToken: null,
    };
  }
}

function persist(state: SessionState) {
  try {
    if (!state.accessToken) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: state.userId,
        displayName: state.displayName,
        workingLocationId: state.workingLocationId,
        accessToken: state.accessToken,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

const initialState: SessionState = loadPersisted();

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{
        userId: string;
        displayName: string;
        workingLocationId?: string | null;
        accessToken: string;
      }>,
    ) {
      state.userId = action.payload.userId;
      state.displayName = action.payload.displayName;
      if (action.payload.workingLocationId !== undefined) {
        state.workingLocationId = action.payload.workingLocationId;
      }
      state.accessToken = action.payload.accessToken;
      persist(state);
    },
    setWorkingLocationId(state, action: PayloadAction<string | null>) {
      state.workingLocationId = action.payload;
      persist(state);
    },
    clearSession(state) {
      state.userId = null;
      state.displayName = null;
      state.workingLocationId = null;
      state.accessToken = null;
      persist(state);
    },
  },
});

export const { setSession, setWorkingLocationId, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
