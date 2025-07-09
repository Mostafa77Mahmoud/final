
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Linking, ScrollView, Animated, Share } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSession } from '../contexts/SessionContext';
import { X, Download, ExternalLink, FileText, Eye, Share as ShareIcon, CheckCircle, Clock } from 'lucide-react-native';

interface ContractPreviewModalProps {
  isVisible: boolean;
  onClose: () => void;
  fileType: 'modified' | 'marked' | null;
}

const ContractPreviewModal: React.FC<ContractPreviewModalProps> = ({
  isVisible,
  onClose,
  fileType
}) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { sessionDetails } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  const contractInfo = fileType === 'modified' 
    ? sessionDetails?.modified_contract_info 
    : sessionDetails?.marked_contract_info;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  const handleOpenInBrowser = async () => {
    if (!contractInfo?.pdf_cloudinary_info?.url) {
      Alert.alert(t('contract.preview.errorTitle') || 'Error', 'No PDF URL available');
      return;
    }

    setIsLoading(true);
    try {
      const url = contractInfo.pdf_cloudinary_info.url;
      console.log('Opening URL:', url);
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback: try to open anyway
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open document:', error);
      Alert.alert(
        t('contract.preview.errorTitle') || 'Error', 
        'Failed to open document. Please try downloading instead.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!contractInfo?.docx_cloudinary_info?.url) {
      Alert.alert(t('contract.preview.errorTitle') || 'Error', 'No download URL available');
      return;
    }

    setIsLoading(true);
    setDownloadProgress(0);

    // Simulate download progress
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 15;
      });
    }, 150);

    try {
      const url = contractInfo.docx_cloudinary_info.url;
      console.log('Downloading from URL:', url);
      
      await Linking.openURL(url);
      
      // Wait for progress to complete
      setTimeout(() => {
        Alert.alert(
          t('common.success') || 'Success', 
          t('contract.preview.downloadStarted') || 'Download started successfully'
        );
      }, 1000);
    } catch (error) {
      console.error('Failed to download document:', error);
      Alert.alert(
        t('contract.preview.errorTitle') || 'Error', 
        t('contract.preview.downloadFailed') || 'Failed to download document'
      );
    } finally {
      setTimeout(() => {
        clearInterval(progressInterval);
        setIsLoading(false);
        setDownloadProgress(0);
      }, 1200);
    }
  };

  const handleShare = async () => {
    if (!contractInfo?.pdf_cloudinary_info?.url) {
      Alert.alert(t('contract.preview.errorTitle') || 'Error', 'No PDF URL available');
      return;
    }

    try {
      const title = fileType === 'modified' 
        ? (t('contract.preview.modifiedTitle') || 'Modified Contract')
        : (t('contract.preview.markedTitle') || 'Marked Contract');

      await Share.share({
        message: `${title}: ${contractInfo.pdf_cloudinary_info.url}`,
        url: contractInfo.pdf_cloudinary_info.url,
        title: title,
      });
    } catch (error) {
      Alert.alert(t('contract.preview.errorTitle') || 'Error', 'Failed to share document');
    }
  };

  if (!isVisible || !fileType || !contractInfo) return null;

  const fileSize = contractInfo.pdf_cloudinary_info?.bytes 
    ? `${(contractInfo.pdf_cloudinary_info.bytes / 1024 / 1024).toFixed(1)} MB`
    : 'Unknown size';

  const createdDate = contractInfo.created_at 
    ? new Date(contractInfo.created_at).toLocaleDateString()
    : 'Unknown date';

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.statusIndicator}>
                <CheckCircle size={16} color="#10b981" />
                <Text style={styles.statusText}>Ready</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <FileText size={52} color={isDark ? '#10b981' : '#059669'} />
                <View style={styles.fileTypeBadge}>
                  <Text style={styles.fileTypeBadgeText}>
                    {fileType === 'modified' ? 'MODIFIED' : 'MARKED'}
                  </Text>
                </View>
              </View>

              <Text style={styles.title}>
                {fileType === 'modified' 
                  ? (t('contract.preview.modifiedTitle') || 'Modified Contract')
                  : (t('contract.preview.markedTitle') || 'Marked Contract')
                }
              </Text>

              <Text style={styles.description}>
                {t('contract.preview.readyDescMobile') || 'Your contract is ready for download and review.'}
              </Text>

              {/* File Information */}
              <View style={styles.fileInfoContainer}>
                <View style={styles.fileInfoItem}>
                  <Text style={styles.fileInfoLabel}>File Size</Text>
                  <Text style={styles.fileInfoValue}>{fileSize}</Text>
                </View>
                <View style={[styles.fileInfoItem, { borderBottomWidth: 1, borderBottomColor: isDark ? '#4b5563' : '#e2e8f0' }]}>
                  <Text style={styles.fileInfoLabel}>Created</Text>
                  <Text style={styles.fileInfoValue}>{createdDate}</Text>
                </View>
                <View style={styles.fileInfoItem}>
                  <Text style={styles.fileInfoLabel}>Format</Text>
                  <Text style={styles.fileInfoValue}>PDF & DOCX</Text>
                </View>
              </View>

              {/* Progress Bar for Download */}
              {isLoading && downloadProgress > 0 && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressText}>Downloading... {downloadProgress}%</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
                  </View>
                </View>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.primaryButton, isLoading && styles.buttonDisabled]} 
                  onPress={handleOpenInBrowser}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Eye size={20} color="#ffffff" />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {t('contract.preview.openInBrowser') || 'Open in Browser'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.secondaryButtonsRow}>
                  <TouchableOpacity 
                    style={[styles.secondaryButton, { flex: 1 }, isLoading && styles.buttonDisabled]} 
                    onPress={handleDownload}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Download size={18} color={isDark ? '#10b981' : '#059669'} />
                    <Text style={styles.secondaryButtonText}>
                      {t('common.download') || 'Download'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.secondaryButton, { flex: 1, marginLeft: 8 }, isLoading && styles.buttonDisabled]} 
                    onPress={handleShare}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <ShareIcon size={18} color={isDark ? '#10b981' : '#059669'} />
                    <Text style={styles.secondaryButtonText}>
                      {t('common.share') || 'Share'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Additional Info */}
              <View style={styles.infoBox}>
                <Clock size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text style={styles.infoText}>
                  Files are available for 30 days
                </Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
    borderWidth: 1,
    borderColor: isDark ? '#374151' : '#e5e7eb',
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#e5e7eb',
  },
  headerLeft: {
    flex: 1,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
  },
  scrollContent: {
    maxHeight: 500,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    borderWidth: 2,
    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(5, 150, 105, 0.2)',
  },
  fileTypeBadge: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: isDark ? '#f59e0b' : '#d97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fileTypeBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: isDark ? '#f9fafb' : '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  fileInfoContainer: {
    width: '100%',
    backgroundColor: isDark ? '#374151' : '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  fileInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fileInfoLabel: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#64748b',
    fontWeight: '500',
  },
  fileInfoValue: {
    fontSize: 14,
    color: isDark ? '#f1f5f9' : '#1e293b',
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: isDark ? '#374151' : '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: isDark ? '#10b981' : '#059669',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: isDark ? '#10b981' : '#059669',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  secondaryButtonText: {
    color: isDark ? '#10b981' : '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? '#374151' : '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    color: isDark ? '#9ca3af' : '#6b7280',
    fontWeight: '500',
  },
});

export default ContractPreviewModal;
