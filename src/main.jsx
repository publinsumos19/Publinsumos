import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import theme from './theme/theme';
import App from './App';
import './index.css';
import { isDemo } from './lib/supabase';

// The demo is a single HTML file that can be opened from anywhere, so it routes with #/.
const Router = isDemo ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ColorModeScript initialColorMode={theme.config?.initialColorMode} />
    <ChakraProvider theme={theme} toastOptions={{ defaultOptions: { position: 'top', isClosable: true, duration: 3500 } }}>
      <Router>
        <App />
      </Router>
    </ChakraProvider>
  </React.StrictMode>,
);
