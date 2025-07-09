
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Camera, RotateCcw, Check, X, Plus, Image as ImageIcon } from 'lucide-react-native';
import { Button } from '../components/ui/button';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

interface CameraScreenProps {
  onUpload?: (file: any) => void;
  onNavigate?: (screen: string) => void;
}

interface CapturedImage {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

const CameraScreen: React.FC<CameraScreenProps> = ({ onUpload, onNavigate }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  useEffect(() => {
    requestPermission();
  }, []);

  const generateWebDocument = useCallback(async (images: CapturedImage[]) => {
    try {
      console.log('Generating web document from', images.length, 'images');

      // Convert images to base64
      const base64Images = await Promise.all(images.map(async (image, index) => {
        console.log(`Converting image ${index + 1} to base64`);

        if (image.base64) {
          return `data:image/jpeg;base64,${image.base64}`;
        }

        // For web, we need to convert blob URLs to base64
        if (Platform.OS === 'web' && image.uri.startsWith('blob:')) {
          try {
            const response = await fetch(image.uri);
            const blob = await response.blob();
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error('Failed to convert blob to base64:', error);
            return '';
          }
        }

        return image.uri;
      }));

      console.log('All images converted to base64');

      // Create text content with base64 images
      const textContent = base64Images.map((base64, index) => 
        `Page ${index + 1}:\n${base64}\n\n`
      ).join('');

      const fileName = `contract_multipage_${Date.now()}.txt`;

      if (Platform.OS === 'web') {
        // Create a file for web
        const file = new File([textContent], fileName, { type: 'text/plain' });
        console.log('Created file:', {
          name: file.name,
          size: file.size,
          type: file.type
        });

        const fileUri = URL.createObjectURL(file);

        return {
          uri: fileUri,
          name: fileName,
          type: 'text/plain',
          size: file.size,
          file: file,
          hasFile: true,
          hasImages: true,
          imageCount: images.length,
          images: images
        };
      } else {
        // For native platforms
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, textContent);

        const fileInfo = await FileSystem.getInfoAsync(fileUri);

        return {
          uri: fileUri,
          name: fileName,
          type: 'text/plain',
          size: fileInfo.size || textContent.length,
          hasImages: true,
          imageCount: images.length,
          images: images
        };
      }
    } catch (error) {
      console.error('Error generating document:', error);
      throw error;
    }
  }, []);

  const generatePDF = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        t('camera.error'),
        t('camera.webError')
      );
      return;
    }

    if (capturedImages.length === 0) {
      Alert.alert(
        t('camera.noPhotos'),
        t('camera.takePhotoFirst')
      );
      return;
    }

    try {
      setIsProcessing(true);

      // Create HTML content with images
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .page { page-break-after: always; margin-bottom: 20px; }
              .page:last-child { page-break-after: auto; }
              img { max-width: 100%; height: auto; border: 1px solid #ddd; }
              h1 { color: #333; text-align: center; }
            </style>
          </head>
          <body>
            <h1>${t('camera.title')} - ${new Date().toLocaleDateString()}</h1>
            ${capturedImages.map((image, index) => `
              <div class="page">
                <h2>Page ${index + 1}</h2>
                <img src="${image.uri}" alt="Contract Page ${index + 1}" />
              </div>
            `).join('')}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('camera.title'),
        });

        Alert.alert(
          t('camera.success'),
          t('camera.pdfGenerated')
        );
      } else {
        Alert.alert(
          t('camera.success'),
          t('camera.documentGenerated')
        );
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert(
        t('camera.pdfError'),
        t('camera.pdfError')
      );
    } finally {
      setIsProcessing(false);
    }
  }, [capturedImages, t]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: false,
      });

      if (photo) {
        const newImage: CapturedImage = {
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          base64: photo.base64,
        };

        setCapturedImages(prev => [...prev, newImage]);
        console.log(`Page ${capturedImages.length + 1} captured successfully`);

        if (capturedImages.length === 0) {
          // First image captured, auto-generate document after small delay
          setTimeout(() => {
            console.log('🎯 Auto-generating document from captured images...');
            analyzeDocument();
          }, 1500);
        } else {
          // Multiple images, show add more option
          Alert.alert(
            t('camera.pageAdded'),
            t('camera.pageAddedMessage', { count: capturedImages.length + 1 }),
            [
              { text: t('camera.addMore'), onPress: () => {} },
              { 
                text: t('camera.finish'), 
                onPress: () => {
                  console.log('🎯 User finished capturing, generating document...');
                  analyzeDocument();
                }
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert(
        t('camera.error'),
        t('camera.captureError')
      );
    }
  }, [capturedImages.length, t]);

  const pickFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newImage: CapturedImage = {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          base64: asset.base64,
        };

        setCapturedImages(prev => [...prev, newImage]);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(
        t('camera.error'),
        t('camera.galleryError')
      );
    }
  }, [t]);

  const analyzeDocument = useCallback(async () => {
    if (capturedImages.length === 0) {
      Alert.alert(
        t('camera.noImages'),
        t('camera.takePhotoFirst')
      );
      return;
    }

    try {
      setIsProcessing(true);
      console.log('Starting document generation for', capturedImages.length, 'images');

      const document = await generateWebDocument(capturedImages);
      console.log('Document generation successful:', document);

      // Always try onUpload first, then fallback to onNavigate
      if (onUpload && typeof onUpload === 'function') {
        console.log('📁 CameraScreen: Calling onUpload with document');
        onUpload(document);
      } else if (onNavigate && typeof onNavigate === 'function') {
        console.log('📁 CameraScreen: Using onNavigate fallback');
        // Navigate to upload with document data in global state or local storage
        // Store the document temporarily
        if (Platform.OS === 'web') {
          try {
            localStorage.setItem('temp_camera_document', JSON.stringify(document));
          } catch (e) {
            console.warn('Could not store document in localStorage');
          }
        }
        onNavigate('upload');
      } else {
        console.error('No navigation handler available');
        Alert.alert(
          t('camera.error'),
          'Navigation not available. Please try again.'
        );
        return;
      }

      // Reset state
      setCapturedImages([]);
      setShowPreview(false);

    } catch (error) {
      console.error('Error analyzing document:', error);
      Alert.alert(
        t('camera.uploadError'),
        t('camera.uploadErrorMessage')
      );
    } finally {
      setIsProcessing(false);
    }
  }, [capturedImages, generateWebDocument, onUpload, onNavigate, t]);

  const retakePhotos = useCallback(() => {
    setCapturedImages([]);
    setShowPreview(false);
  }, []);

  const toggleCameraFacing = useCallback(() => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{t('camera.requestingPermission')}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>{t('camera.permissionDenied')}</Text>
          <Button onPress={requestPermission} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>{t('camera.grantPermission')}</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (showPreview && capturedImages.length > 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('camera.preview')} ({capturedImages.length} {t('camera.pages')})
          </Text>
        </View>

        <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContent}>
          {capturedImages.map((image, index) => (
            <View key={index} style={styles.previewImageContainer}>
              <Text style={styles.pageLabel}>{t('camera.page')} {index + 1}</Text>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
            </View>
          ))}
        </ScrollView>

        <View style={styles.previewActions}>
          <Button
            onPress={retakePhotos}
            variant="outline"
            style={[styles.actionButton, styles.retakeButton]}
            disabled={isProcessing}
          >
            <X size={20} color={isDark ? '#fff' : '#000'} />
            <Text style={styles.actionButtonText}>{t('camera.retake')}</Text>
          </Button>

          <Button
            onPress={analyzeDocument}
            style={[styles.actionButton, styles.confirmButton]}
            disabled={isProcessing}
          >
            <Check size={20} color="#fff" />
            <Text style={styles.confirmButtonText}>
              {isProcessing ? t('processing') : t('camera.analyzeDocument')}
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('camera.title')}</Text>
        {capturedImages.length > 0 && (
          <Text style={styles.captureCount}>
            {capturedImages.length} {t('camera.photosCount')}
          </Text>
        )}
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash="off"
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={pickFromGallery}
        >
          <ImageIcon size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.captureButton}
          onPress={takePicture}
        >
          <View style={styles.captureButtonInner}>
            <Camera size={32} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.flipButton}
          onPress={toggleCameraFacing}
        >
          <RotateCcw size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>

      {capturedImages.length > 0 && (
        <View style={styles.bottomActions}>
          <Button
            onPress={() => setShowPreview(true)}
            style={styles.previewButton}
          >
            <Text style={styles.previewButtonText}>{t('camera.preview')}</Text>
          </Button>

          {Platform.OS !== 'web' && (
            <Button
              onPress={generatePDF}
              variant="outline"
              style={styles.pdfButton}
              disabled={isProcessing}
            >
              <Text style={styles.pdfButtonText}>
                {isProcessing ? t('processing') : t('camera.generatePDF')}
              </Text>
            </Button>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#fff',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDark ? '#fff' : '#000',
    textAlign: 'center',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  captureCount: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#6b7280',
    marginTop: 4,
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  camera: {
    flex: 1,
  },
  controls: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
      },
    }),
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  previewButton: {
    flex: 1,
    backgroundColor: '#10b981',
  },
  previewButtonText: {
    color: '#fff',
    fontWeight: '600',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  pdfButton: {
    flex: 1,
    borderColor: '#6b7280',
  },
  pdfButtonText: {
    color: isDark ? '#fff' : '#374151',
    fontWeight: '600',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  previewContainer: {
    flex: 1,
  },
  previewContent: {
    padding: 20,
  },
  previewImageContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  pageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#fff' : '#000',
    marginBottom: 10,
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  previewImage: {
    width: width - 40,
    height: (width - 40) * 1.4,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  previewActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  retakeButton: {
    backgroundColor: 'transparent',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  confirmButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: isDark ? '#fff' : '#ef4444',
    fontWeight: '600',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    color: isDark ? '#fff' : '#000',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  message: {
    fontSize: 16,
    color: isDark ? '#fff' : '#000',
    textAlign: 'center',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
});

export default CameraScreen;
