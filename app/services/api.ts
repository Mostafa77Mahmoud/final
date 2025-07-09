
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Web fallback using localStorage
const webStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (error) {
      console.warn('localStorage read failed:', error);
    }
    return null;
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('localStorage write failed:', error);
    }
  },

  async deleteItemAsync(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('localStorage delete failed:', error);
    }
  }
};

const storage = Platform.OS === 'web' ? webStorage : SecureStore;

// --- API Configuration ---
// Use 10.0.2.2 for Android emulator to connect to localhost on the host machine.
// For web and iOS simulator, 'localhost' or your computer's local IP should work.
const API_BASE_URL = Constants?.expoConfig?.extra?.API_URL || 'http://localhost:5000';
const NGROK_SKIP_BROWSER_WARNING_HEADER = { 'ngrok-skip-browser-warning': 'true' };

// --- Exported Types ---
export interface User { id: string; email: string; username?: string; role: 'regular_user' | 'shariah_expert'; }
export interface LoginCredentials { email: string; password: string; }
export interface SignupCredentials extends LoginCredentials { username?: string; }
export interface AuthResponse { token: string; user: User; }
export interface ApiAnalysisTerm { term_id: string; term_text: string; is_valid_sharia: boolean; sharia_issue?: string; reference_number?: string; modified_term?: string; is_confirmed_by_user?: boolean; confirmed_modified_text?: string | null; has_expert_feedback?: boolean; last_expert_feedback_id?: string | null; expert_override_is_valid_sharia?: boolean | null; }
export interface AnalyzeApiResponse { message: string; analysis_results: ApiAnalysisTerm[]; session_id: string; original_contract_plain?: string; detected_contract_language: 'ar' | 'en'; original_cloudinary_url?: string; }
export interface SessionDetailsApiResponse { _id: string; session_id: string; original_filename: string; analysis_timestamp: string; analysis_results: ApiAnalysisTerm[]; compliance_percentage?: number; detected_contract_language: 'ar' | 'en'; original_contract_plain?: string; original_format: string; original_contract_markdown?: string; original_cloudinary_info?: CloudinaryFileInfo; analysis_results_cloudinary_info?: CloudinaryFileInfo; modified_contract_info?: any; marked_contract_info?: any; pdf_preview_info?: any; }
export interface CloudinaryFileInfo { url: string; public_id: string; format: string; user_facing_filename?: string; }
export interface GenerateModifiedContractApiResponse { success: boolean; message: string; modified_docx_cloudinary_url?: string; modified_txt_cloudinary_url?: string; }
export interface GenerateMarkedContractApiResponse { success: boolean; message: string; marked_docx_cloudinary_url?: string; }
export interface ConfirmModificationApiResponse { success: boolean; message: string; }
export interface ReviewModificationApiResponse { reviewed_text: string; is_still_valid_sharia: boolean; new_sharia_issue?: string | null; new_reference_number?: string | null; }
export interface ExpertFeedbackPayload { session_id: string; term_id: string; feedback_data: { aiAnalysisApproved: boolean | null; expertIsValidSharia?: boolean; expertComment: string; expertCorrectedShariaIssue?: string; expertCorrectedSuggestion?: string; }; }
export interface ExpertFeedbackApiResponse { success: boolean; message: string; feedback_id?: string; }

export interface ContractAnalysis {
  id: string;
  fileName: string;
  timestamp: string;
  isCompliant: boolean;
  complianceScore: number;
  issues: string[];
  recommendations: string[];
  summary: string;
  extractedText: string;
}

// --- Helper Functions ---
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // If the response is not JSON, use the status text.
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text() as unknown as Promise<T>;
}

const getAuthToken = (): Promise<string | null> => storage.getItemAsync('auth_token');

const getHeaders = async (isFormData = false) => {
    const headers: Record<string, string> = { ...NGROK_SKIP_BROWSER_WARNING_HEADER };

    try {
      const token = await getAuthToken();
      
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }
    
    return headers;
}

// --- Auth API ---
export const authApi = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: await getHeaders(), body: JSON.stringify(credentials) });
        return handleResponse<AuthResponse>(response);
    },
    signup: async (credentials: SignupCredentials): Promise<AuthResponse> => {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, { method: 'POST', headers: await getHeaders(), body: JSON.stringify(credentials) });
        return handleResponse<AuthResponse>(response);
    },
    logout: async (): Promise<void> => Promise.resolve(),
    getProfile: async (): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, { method: 'GET', headers: await getHeaders() });
        return handleResponse<User>(response);
    }
};


class ApiService {
  private baseURL = API_BASE_URL;

  async analyzeContract(file: any, onUploadProgress?: (progress: number) => void): Promise<AnalyzeApiResponse> {
    try {

      console.log('📤 API: Starting upload with file:', {
        uri: file.uri,
        type: file.type,
        name: file.name,
        size: file.size,
        hasMetadata: !!file.metadata,
        hasImages: !!file.images,
        isMultiPage: file.images?.length > 1
      });

      const formData = new FormData();

      try {
        // Handle multi-page image documents
        if (file.images && Array.isArray(file.images) && file.images.length >= 1) {
          console.log('📤 API: Processing multi-page document with', file.images.length, 'pages');

          if (Platform.OS === 'web' && file.file) {
            // For web, use the file directly (it's already a text file with base64 data)
            formData.append('file', file.file);
            formData.append('upload_type', 'multi-page-images');
            formData.append('total_pages', file.images.length.toString());

            console.log('📤 API: Added web multi-page text file to FormData');
          } else {
            // For native platforms, create a file with the multi-page data
            const fileData = {
              uri: file.uri,
              type: file.type || 'text/plain',
              name: file.name || `contract_multipage_${Date.now()}.txt`,
            } as any;

            formData.append('file', fileData);
            formData.append('upload_type', 'multi-page-images');
            formData.append('total_pages', file.images.length.toString());

            console.log('📤 API: Added native multi-page text file to FormData');
          }
        } 
        // Handle single file uploads (legacy)
        else if (Platform.OS === 'web' && file.file) {
          formData.append('file', file.file);
          console.log('📤 API: Added web file to FormData');
        } else {
          // React Native single file upload
          const fileData = {
            uri: file.uri,
            type: file.type || file.mimeType || 'image/jpeg',
            name: file.name || `upload_${Date.now()}.jpg`,
          } as any;

          if (file.size) {
            fileData.size = file.size;
          }

          formData.append('file', fileData);
          console.log('📤 API: Added native file to FormData:', fileData);

          // Add metadata if available
          if (file.metadata) {
            formData.append('metadata', JSON.stringify(file.metadata));
            console.log('📤 API: Added metadata:', file.metadata);
          }
        }

        onUploadProgress?.(30);

        const headers = await getHeaders(true);
        console.log('📤 API: Request headers prepared');

        onUploadProgress?.(50);

        console.log('📤 API: Sending request to:', `${this.baseURL}/analyze`);
        console.log('📤 API: FormData entries:');
        for (let pair of formData.entries()) {
          if (pair[1] instanceof File || pair[1] instanceof Blob) {
            console.log(`  ${pair[0]}: [${pair[1].constructor.name}] ${pair[1].name || 'unnamed'} (${pair[1].size} bytes)`);
          } else {
            console.log(`  ${pair[0]}: ${pair[1]}`);
          }
        }

        const response = await fetch(`${this.baseURL}/analyze`, { 
          method: 'POST', 
          body: formData, 
          headers
        });

        console.log('📤 API: Response received:', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type')
        });

        onUploadProgress?.(100);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API: Upload failed:', {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText
          });
          throw new Error(`Upload failed (${response.status}): ${errorText || response.statusText}`);
        }

        const result = await handleResponse<AnalyzeApiResponse>(response);
        console.log('✅ API: Upload successful, session ID:', result.session_id);
        return result;
      } catch (error) {
        console.error('❌ API: Upload error:', error);
        onUploadProgress?.(0);
        throw error;
      }
    } catch (error) {
      console.error('Contract analysis error:', error);
      throw error;
    }
  }

  async generatePDF(analysis: SessionDetailsApiResponse): Promise<string> {
    // PDF generation only works on native platforms
    if (Platform.OS === 'web') {
      throw new Error('PDF generation is not supported on web platform');
    }
    
    try {
      const htmlContent = this.generateHTMLReport(analysis);

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      return uri;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  }

  async sharePDF(pdfUri: string): Promise<void> {
    // PDF sharing only works on native platforms
    if (Platform.OS === 'web') {
      throw new Error('PDF sharing is not supported on web platform');
    }
    
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Contract Analysis Report',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('PDF sharing error:', error);
      throw error;
    }
  }

  private generateHTMLReport(analysis: SessionDetailsApiResponse): string {
    const complianceColor = analysis.compliance_percentage && analysis.compliance_percentage >= 70 ? '#10b981' : '#ef4444';
    const complianceText = analysis.compliance_percentage && analysis.compliance_percentage >= 70 ? 'Compliant' : 'Non-Compliant';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Sharia Compliance Analysis Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #10b981;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .compliance-badge {
              display: inline-block;
              padding: 10px 20px;
              border-radius: 25px;
              color: white;
              font-weight: bold;
              background-color: ${complianceColor};
            }
            .section {
              margin: 30px 0;
            }
            .section h2 {
              color: #10b981;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 10px;
            }
            .score {
              font-size: 2em;
              font-weight: bold;
              color: ${complianceColor};
            }
            .issue, .recommendation {
              margin: 10px 0;
              padding: 10px;
              border-left: 4px solid #10b981;
              background-color: #f9fafb;
            }
            .footer {
              text-align: center;
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sharia Compliance Analysis Report</h1>
            <div class="compliance-badge">${complianceText}</div>
            <p>File: ${analysis.original_filename}</p>
            <p>Generated: ${new Date(analysis.analysis_timestamp).toLocaleString()}</p>
          </div>

          <div class="section">
            <h2>Compliance Score</h2>
            <div class="score">${analysis.compliance_percentage}%</div>
          </div>

          <div class="section">
            <h2>Summary</h2>
            <p>${analysis.original_contract_plain}</p>
          </div>

          ${analysis.analysis_results.filter(r => !r.is_valid_sharia).length > 0 ? `
          <div class="section">
            <h2>Issues Found</h2>
            ${analysis.analysis_results.filter(r => !r.is_valid_sharia).map(issue => `<div class="issue">${issue.sharia_issue}</div>`).join('')}
          </div>
          ` : ''}

          <div class="footer">
            <p>Generated by Shariaa Analyzer</p>
            <p>This report is for informational purposes only and should not be considered as legal advice.</p>
          </div>
        </body>
      </html>
    `;
  }

  async saveAnalysis(analysis: SessionDetailsApiResponse): Promise<void> {
    // File system operations only work on native platforms
    if (Platform.OS === 'web') {
      console.warn('File system operations not supported on web');
      return;
    }
    
    try {
      const fileName = `analysis_${analysis.session_id}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(analysis, null, 2)
      );
    } catch (error) {
      console.error('Error saving analysis:', error);
      throw error;
    }
  }

  async loadSavedAnalyses(): Promise<SessionDetailsApiResponse[]> {
    // File system operations only work on native platforms
    if (Platform.OS === 'web') {
      console.warn('File system operations not supported on web');
      return [];
    }
    
    try {
      const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory!);
      if (!dirInfo.exists) return [];

      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
      const analysisFiles = files.filter(file => file.startsWith('analysis_') && file.endsWith('.json'));

      const analyses: SessionDetailsApiResponse[] = [];
      for (const file of analysisFiles) {
        try {
          const fileUri = `${FileSystem.documentDirectory}${file}`;
          const content = await FileSystem.readAsStringAsync(fileUri);
          const analysis = JSON.parse(content);
          analyses.push(analysis);
        } catch (error) {
          console.error(`Error loading analysis file ${file}:`, error);
        }
      }

      return analyses.sort((a, b) => new Date(b.analysis_timestamp).getTime() - new Date(a.analysis_timestamp).getTime());
    } catch (error) {
      console.error('Error loading saved analyses:', error);
      return [];
    }
  }
}

export const apiService = new ApiService();

export const uploadContract = apiService.analyzeContract.bind(apiService);
export const generatePDF = apiService.generatePDF.bind(apiService);
export const sharePDF = apiService.sharePDF.bind(apiService);

export const getSessionHistory = async (): Promise<SessionDetailsApiResponse[]> => {
  try {
    const headers = await getHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${API_BASE_URL}/api/history`, { 
      method: 'GET', 
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return handleResponse<SessionDetailsApiResponse[]>(response);
  } catch (error) {
    console.warn('Session history fetch failed:', error);
    // Return empty array to fallback to local data
    return [];
  }
};

export const getStats = async (): Promise<any> => {
  try {
    const headers = await getHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${API_BASE_URL}/api/stats/user`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await handleResponse<any>(response);
  } catch (error) {
    console.warn('Error fetching stats:', error);

    // Return fallback stats when API fails
    return {
      totalSessions: 0,
      totalTerms: 0,
      complianceRate: 0,
      averageProcessingTime: 0,
    };
  }
};

export const getSessionDetails = async (sessionId: string): Promise<SessionDetailsApiResponse> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, { method: 'GET', headers });
  return handleResponse<SessionDetailsApiResponse>(response);
};

export const getSessionTerms = async (sessionId: string): Promise<ApiAnalysisTerm[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/terms/${sessionId}`, { method: 'GET', headers });
  return handleResponse<ApiAnalysisTerm[]>(response);
};

export const askQuestion = async (sessionId: string, question: string, termId?: string, termText?: string): Promise<string> => {
  const headers = await getHeaders();
  const payload = { session_id: sessionId, question, term_id: termId, term_text: termText };
  const response = await fetch(`${API_BASE_URL}/interact`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const textResponse = await response.text();
  if (!response.ok) throw new Error(textResponse || 'Failed to ask question');
  return textResponse;
};

export const reviewUserModification = async (sessionId: string, termId: string, userModifiedText: string, originalTermText: string): Promise<ReviewModificationApiResponse> => {
    const headers = await getHeaders();
    const payload = { session_id: sessionId, term_id: termId, user_modified_text: userModifiedText, original_term_text: originalTermText };
    const response = await fetch(`${API_BASE_URL}/review_modification`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<ReviewModificationApiResponse>(response);
};

export const confirmTermModification = async (sessionId: string, termId: string, modifiedText: string): Promise<ConfirmModificationApiResponse> => {
    const headers = await getHeaders();
    const payload = { session_id: sessionId, term_id: termId, modified_text: modifiedText };
    const response = await fetch(`${API_BASE_URL}/confirm_modification`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<ConfirmModificationApiResponse>(response);
};

export const generateModifiedContract = async (sessionId: string): Promise<GenerateModifiedContractApiResponse> => {
    const headers = await getHeaders();
    const payload = { session_id: sessionId };
    const response = await fetch(`${API_BASE_URL}/generate_modified_contract`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<GenerateModifiedContractApiResponse>(response);
};

export const generateMarkedContract = async (sessionId: string): Promise<GenerateMarkedContractApiResponse> => {
    const headers = await getHeaders();
    const payload = { session_id: sessionId };
    const response = await fetch(`${API_BASE_URL}/generate_marked_contract`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<GenerateMarkedContractApiResponse>(response);
};

export const submitExpertFeedback = async (payload: ExpertFeedbackPayload): Promise<ExpertFeedbackApiResponse> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/feedback/expert`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<ExpertFeedbackApiResponse>(response);
};

// --- Local Storage Functions ---
export const saveSessionLocally = async (session: SessionDetailsApiResponse): Promise<void> => {
  try {
    const sessions = await getLocalSessions();
    const updatedSessions = sessions.filter(s => s.session_id !== session.session_id);
    updatedSessions.unshift(session);
    await storage.setItemAsync('shariaa_sessions', JSON.stringify(updatedSessions.slice(0, 50)));
  } catch (error) { console.error('Failed to save session locally:', error); }
};

export const getLocalSessions = async (): Promise<SessionDetailsApiResponse[]> => {
  try {
    const sessions = await storage.getItemAsync('shariaa_sessions');
    return sessions ? JSON.parse(sessions) : [];
  } catch (error) { return []; }
};

export const deleteLocalSession = async (sessionId: string): Promise<void> => {
  try {
    const sessions = await getLocalSessions();
    const updatedSessions = sessions.filter(s => s.session_id !== sessionId);
    await storage.setItemAsync('shariaa_sessions', JSON.stringify(updatedSessions));
  } catch (error) { console.error('Failed to delete local session:', error); }
};
export default {
  authApi,
  uploadContract,
  getSessionHistory,
  getStats,
  getSessionDetails,
  getSessionTerms,
  askQuestion,
  reviewUserModification,
  confirmTermModification,
  generateModifiedContract,
  generateMarkedContract,
  submitExpertFeedback,
  saveSessionLocally,
  getLocalSessions,
  deleteLocalSession,
};
