import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createAppStore } from '@vaybooks/store';
import '@vaybooks/theme';
import ShellApp from '../../shell/src/App';

const store = createAppStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ShellApp />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
