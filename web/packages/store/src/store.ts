import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api';
import licenseReducer from './licenseSlice';
import sessionReducer from './sessionSlice';

export function createAppStore() {
  return configureStore({
    reducer: {
      session: sessionReducer,
      license: licenseReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(baseApi.middleware),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
