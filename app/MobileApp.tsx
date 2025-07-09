
import React, { useState, useEffect, useCallback } from 'react';
import { View, StatusBar, SafeAreaView, Alert, StyleSheet, Animated, Platform } from 'react-native';
import { useTheme } from './contexts/ThemeContext';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { useSession } from './contexts/SessionContext';

// Import screens
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import ResultsScreen from './screens/ResultsScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import CameraScreen from './screens/CameraScreen';

// Import components
import MobileNavigation from './components/MobileNavigation';
import { EnhancedHeader } from './components/enhanced/EnhancedHeader';

const MobileApp: React.FC = () => {
  const { theme } = useTheme();
  const { language, isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const { sessionId } = useSession();

  const [currentScreen, setCurrentScreen] = useState('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [cameraGeneratedFile, setCameraGeneratedFile] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      setShowOnboarding(true);
    }
  }, [authLoading, user]);

  // Check for stored camera document on web
  useEffect(() => {
    if (Platform.OS === 'web' && currentScreen === 'upload') {
      try {
        const storedDoc = localStorage.getItem('temp_camera_document');
        if (storedDoc) {
          const document = JSON.parse(storedDoc);
          setCameraGeneratedFile(document);
          localStorage.removeItem('temp_camera_document');
        }
      } catch (e) {
        console.warn('Could not retrieve stored document');
      }
    }
  }, [currentScreen]);

  const handleNavigate = (screen: string) => {
    // Clear camera file when navigating away from upload
    if (currentScreen === 'upload' && screen !== 'upload') {
      setCameraGeneratedFile(null);
    }
    
    // Add fade animation for screen transitions
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentScreen(screen);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleAnalysisComplete = (sessionId: string) => {
    // Clear camera file after successful analysis
    setCameraGeneratedFile(null);
    setCurrentScreen('results');
  };

  const handleCameraUpload = useCallback((file: any) => {
    console.log('📁 MobileApp: Received file from camera:', {
      name: file?.name,
      type: file?.type,
      size: file?.size,
      hasImages: file?.hasImages
    });
    
    // Store the file and navigate to upload
    setCameraGeneratedFile(file);
    setCurrentScreen('upload');
  }, []);

  const renderCurrentScreen = () => {
    if (showOnboarding) {
      return (
        <OnboardingScreen 
          onComplete={() => setShowOnboarding(false)} 
        />
      );
    }

    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={handleNavigate} />;
      case 'upload':
        return (
          <UploadScreen 
            onAnalysisComplete={handleAnalysisComplete}
            onBack={() => handleNavigate('home')}
            preSelectedFile={cameraGeneratedFile}
            fromCamera={!!cameraGeneratedFile}
            autoUpload={!!cameraGeneratedFile}
          />
        );
      case 'camera':
        return (
          <CameraScreen 
            onNavigate={handleNavigate}
            onUpload={handleCameraUpload}
          />
        );
      case 'history':
        return <HistoryScreen onNavigate={handleNavigate} />;
      case 'profile':
        return <ProfileScreen />;
      case 'results':
        return sessionId ? <ResultsScreen onNavigate={handleNavigate} /> : <HomeScreen onNavigate={handleNavigate} />;
      default:
        return <HomeScreen onNavigate={handleNavigate} />;
    }
  };

  const backgroundColor = theme === 'dark' ? '#111827' : '#f9fafb';
  const statusBarStyle = theme === 'dark' ? 'light-content' : 'dark-content';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar 
        barStyle={statusBarStyle} 
        backgroundColor={backgroundColor}
        translucent={false}
      />

      {!showOnboarding && (
        <EnhancedHeader 
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
        />
      )}

      <Animated.View 
        style={[
          styles.content, 
          { 
            backgroundColor,
            opacity: fadeAnim,
            // Improve RTL handling for web
            direction: isRTL ? 'rtl' : 'ltr',
            ...(Platform.OS === 'web' && isRTL && {
              transform: [{ scaleX: 1 }] // Remove the flip, use CSS direction instead
            })
          }
        ]}
      >
        {renderCurrentScreen()}
      </Animated.View>

      {!showOnboarding && (
        <MobileNavigation 
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default MobileApp;
