import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const darkBg = {
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#0a1929 0%,#0d2b47 25%,#124b73 50%,#1e79a6 75%,#4ab8ce 100%)',
      backgroundAttachment: 'fixed',
} as React.CSSProperties;

const innerWrap = {
      position: 'relative' as const,
      zIndex: 10,
      display: 'flex',
      width: '100%',
};

const contentCol = {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      minWidth: 0,
};

const mainStyle = {
      flex: 1,
      padding: '28px 32px',
      overflowY: 'auto' as const,
      position: 'relative' as const,
      zIndex: 10,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
      return React.createElement(
              'div', { style: darkBg },
              React.createElement(
                        'div', { style: innerWrap },
                        React.createElement(Sidebar, null),
                        React.createElement(
                                    'div', { style: contentCol },
                                    React.createElement(Header, null),
                                    React.createElement('main', { style: mainStyle }, children)
                                  )
                      )
            );
}
