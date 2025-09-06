import * as ReactDOM from 'react-dom/client';
import App from './app/App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);
root.render(<App />);

serviceWorkerRegistration.register();
