
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from './app/contexts/LanguageContext';
import { ThemeProvider } from './app/contexts/ThemeContext';
import { AuthProvider } from './app/contexts/AuthContext';
import { ContractProvider } from './app/contexts/ContractContext';
import { SessionProvider } from './app/contexts/SessionContext';
import MobileApp from './app/MobileApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <SessionProvider>
              <ContractProvider>
                <MobileApp />
              </ContractProvider>
            </SessionProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
