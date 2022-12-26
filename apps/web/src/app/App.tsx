import '../theme/fonts.css';
import '../theme/tailwind.css';

import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { RxDbProvider } from '../components/RxDbProvider';
import { UserProvider } from '../components/UserProvider';
import { NotificationProvider } from '../services/NotificationContext';
import { TabWrapper } from '../components/TabWrapper';

export default function App() {
  return (
    <NotificationProvider>
      <RxDbProvider>
        <UserProvider>
          <Router>
            <TabWrapper />
          </Router>
        </UserProvider>
      </RxDbProvider>
    </NotificationProvider>
  );
}
