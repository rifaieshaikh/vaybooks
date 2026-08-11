import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const SESSION_STORAGE_KEY = 'vaybooks.session.v1';

export interface SessionState {
  userId: string | null;
  displayName: string | null;
  workingLocationId: string | null;
  accessToken: string | null;
  permissions: string[];
  enabledModules: string[];
}

function emptySession(): SessionState {
  return {
    userId: null,
    displayName: null,
    workingLocationId: null,
    accessToken: null,
    permissions: [],
    enabledModules: [],
  };
}

function loadPersisted(): SessionState {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return {
      userId: parsed.userId ?? null,
      displayName: parsed.displayName ?? null,
      workingLocationId: parsed.workingLocationId ?? null,
      accessToken: parsed.accessToken ?? null,
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions.map(String) : [],
      enabledModules: Array.isArray(parsed.enabledModules)
        ? parsed.enabledModules.map(String)
        : [],
    };
  } catch {
    return emptySession();
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
        permissions: state.permissions,
        enabledModules: state.enabledModules,
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
        permissions?: string[];
        enabledModules?: string[];
      }>,
    ) {
      state.userId = action.payload.userId;
      state.displayName = action.payload.displayName;
      if (action.payload.workingLocationId !== undefined) {
        state.workingLocationId = action.payload.workingLocationId;
      }
      state.accessToken = action.payload.accessToken;
      if (action.payload.permissions !== undefined) {
        state.permissions = action.payload.permissions;
      }
      if (action.payload.enabledModules !== undefined) {
        state.enabledModules = action.payload.enabledModules;
      }
      persist(state);
    },
    setPermissions(state, action: PayloadAction<string[]>) {
      state.permissions = action.payload;
      persist(state);
    },
    setEnabledModules(state, action: PayloadAction<string[]>) {
      state.enabledModules = action.payload;
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
      state.permissions = [];
      state.enabledModules = [];
      persist(state);
    },
  },
});

export const {
  setSession,
  setPermissions,
  setEnabledModules,
  setWorkingLocationId,
  clearSession,
} = sessionSlice.actions;
export default sessionSlice.reducer;
